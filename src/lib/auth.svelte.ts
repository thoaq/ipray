import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './supabaseClient';
import { db } from './db';
import { pauseSync, resumeSync } from './syncControl';

// Zugang über Einladungslink: anonyme Anmeldung ohne Passwort/E-Mail (siehe Konzept,
// Architektur Schicht 2). Der "Wiederherstellungs-Code" für ein zweites Gerät ist
// bewusst einfach gehalten: der Supabase-Refresh-Token selbst, den man auf dem neuen
// Gerät einträgt, um dieselbe Sitzung wiederherzustellen — kein eigener Server-Baustein
// nötig, robuster als ein selbst gebautes Token-System.

// Zusätzlich zu this.session (nur im Speicher) in localStorage gemerkt: this.session ist
// beim App-Start kurzzeitig null, bis getSession()/bootstrapAnonymous() durchgelaufen sind.
// Verbindet man in genau diesem Fenster ein Gerät neu, läse restoreOnThisDevice() sonst eine
// leere "vorige Identität" — obwohl Dexie noch echte Daten eines vorigen Kontos enthält — und
// würde das Aufräumen fälschlich überspringen.
const LAST_ACCOUNT_KEY = 'gebetsraum:lastAccountId';

function rememberAccountId(userId: string | undefined) {
	if (typeof window === 'undefined' || !userId) return;
	localStorage.setItem(LAST_ACCOUNT_KEY, userId);
}

function lastKnownAccountId(): string | undefined {
	if (typeof window === 'undefined') return undefined;
	return localStorage.getItem(LAST_ACCOUNT_KEY) ?? undefined;
}

class AuthState {
	session: Session | null = $state(null);
	ready = $state(false);
	error: string | null = $state(null);

	userId = $derived(this.session?.user?.id ?? null);
	signedIn = $derived(this.session !== null);

	/** Ist an dieses Konto (auf diesem Gerät sichtbar) ein Google-Konto verknüpft? Steuert
	 *  in der Konto-Ansicht, ob Code-basierte Gerätekopplung oder Google-Anmeldung als Weg
	 *  fürs nächste Gerät angezeigt wird — siehe Offene Punkte in KONZEPT.md. */
	googleLinked = $derived(
		this.session?.user?.identities?.some((identity) => identity.provider === 'google') ?? false
	);

	constructor() {
		if (typeof window === 'undefined' || !supabaseConfigured || !supabase) {
			this.ready = true;
			return;
		}

		supabase.auth.onAuthStateChange((event, session) => {
			void this.handleAuthChange(event, session);
		});

		supabase.auth.getSession().then(({ data }) => {
			if (data.session) {
				this.session = data.session;
				rememberAccountId(data.session.user?.id);
				this.ready = true;
			} else {
				this.bootstrapAnonymous();
			}
		});
	}

	// Google-Anmeldung auf einem neuen Gerät (signInWithOAuth, andere user_id als die bisherige
	// anonyme Identität dieses Geräts) muss wie restoreOnThisDevice() lokal aufräumen, sonst
	// vermischen sich die Konten. Läuft nur bei event 'SIGNED_IN' — refreshSession() (Code-Flow)
	// feuert 'TOKEN_REFRESHED' und behält seine eigene, explizite Aufräum-Logik unten; das
	// Verknüpfen per linkIdentity() ändert die user_id nicht, löst darum hier nichts aus.
	private async handleAuthChange(event: string, session: Session | null) {
		const previousUserId = this.session?.user?.id ?? lastKnownAccountId();
		if (event === 'SIGNED_IN' && previousUserId && session && session.user.id !== previousUserId) {
			pauseSync();
			try {
				await Promise.all([db.prayers.clear(), db.favorites.clear(), db.categoryOverrides.clear()]);
				await db.syncMeta.clear();
			} finally {
				resumeSync();
			}
		}
		this.session = session;
		rememberAccountId(session?.user?.id);
	}

	private async bootstrapAnonymous() {
		if (!supabase) return;
		const { data, error } = await supabase.auth.signInAnonymously();
		if (error) this.error = error.message;
		else {
			this.session = data.session;
			rememberAccountId(data.session?.user?.id);
		}
		this.ready = true;
	}

	/** Der Code, den man sich merken/kopieren muss, um dieses Konto auf einem neuen Gerät zu öffnen. */
	get recoveryCode(): string | null {
		return this.session?.refresh_token ?? null;
	}

	/** Stabile Konto-Kennung (die interne Nutzer-ID) — anders als der Wiederherstellungs-Code
	 *  bleibt sie über Sitzungserneuerungen hinweg gleich, taugt also zum Vergleichen, ob zwei
	 *  Geräte am selben Konto hängen. Erlaubt für sich genommen keinen Zugriff, kann also
	 *  gefahrlos angezeigt werden. */
	get accountId(): string | null {
		return this.session?.user?.id ?? null;
	}

	async restoreOnThisDevice(code: string): Promise<{ ok: boolean; error?: string }> {
		if (!supabase) return { ok: false, error: 'Supabase ist noch nicht konfiguriert.' };
		const trimmed = code.trim();
		if (!trimmed) return { ok: false, error: 'Bitte einen Code eingeben.' };

		// Vorher merken: refreshSession() löst den onAuthStateChange-Listener bereits
		// während des Aufrufs aus, der this.session sonst zu früh auf die neue Identität
		// umstellen würde. Sync bleibt bis zum Aufräumen pausiert, damit kein zeitgleicher
		// Sync-Lauf lokale Reste der alten Identität unter der neuen Identität pusht.
		// Fällt auf die in localStorage gemerkte Kennung zurück, falls this.session hier
		// (noch) leer ist (z.B. direkt beim App-Start) — sonst gilt eine tatsächlich vorhandene
		// vorige Identität fälschlich als "keine", und das Aufräumen unten wird übersprungen.
		const previousUserId = this.session?.user?.id ?? lastKnownAccountId();
		pauseSync();
		try {
			const { data, error } = await supabase.auth.refreshSession({ refresh_token: trimmed });
			if (error || !data.session) {
				return { ok: false, error: error?.message ?? 'Code ungültig oder abgelaufen.' };
			}

			if (previousUserId && previousUserId !== data.session.user.id) {
				await Promise.all([db.prayers.clear(), db.favorites.clear(), db.categoryOverrides.clear()]);
			}
			// Pull-Cursor (syncMeta) immer zurücksetzen, unabhängig davon, ob sich die Identität hier
			// sicher als "gewechselt" erkennen ließ — ein dabei stehen gebliebener alter Zeitstempel
			// würde beim nächsten Pull ältere Zeilen des jetzt verbundenen Kontos dauerhaft ausschließen
			// (gt('updated_at', since) lässt sie für immer verschwinden, nicht nur vorübergehend).
			await db.syncMeta.clear();

			this.session = data.session;
			rememberAccountId(data.session.user?.id);
			return { ok: true };
		} finally {
			resumeSync();
		}
	}

	/** Verknüpft das aktuell auf diesem Gerät angemeldete (anonyme) Konto per OAuth mit Google
	 *  (gleiche user_id, keine Datenmigration). Leitet den Browser zu Google weiter — die Seite
	 *  wird danach mit dem gleichen Konto neu geladen, jetzt mit einer zweiten Identität. */
	async linkGoogle(): Promise<{ ok: boolean; error?: string }> {
		if (!supabase) return { ok: false, error: 'Supabase ist noch nicht konfiguriert.' };
		const { error } = await supabase.auth.linkIdentity({
			provider: 'google',
			options: { redirectTo: `${window.location.origin}/konto` }
		});
		if (error) return { ok: false, error: error.message };
		return { ok: true };
	}

	/** Meldet dieses Gerät per Google an — für ein bereits mit Google verknüpftes Konto ersetzt
	 *  das die bisherige (leere) anonyme Sitzung dieses Geräts durch die verknüpfte Identität;
	 *  das Aufräumen lokaler Reste übernimmt handleAuthChange() beim Rücksprung. */
	async signInWithGoogle(): Promise<{ ok: boolean; error?: string }> {
		if (!supabase) return { ok: false, error: 'Supabase ist noch nicht konfiguriert.' };
		const { error } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: `${window.location.origin}/konto` }
		});
		if (error) return { ok: false, error: error.message };
		return { ok: true };
	}
}

export const auth = new AuthState();
