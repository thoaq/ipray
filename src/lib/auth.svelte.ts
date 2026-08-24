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

	constructor() {
		if (typeof window === 'undefined' || !supabaseConfigured || !supabase) {
			this.ready = true;
			return;
		}

		supabase.auth.onAuthStateChange((_event, session) => {
			this.session = session;
			rememberAccountId(session?.user?.id);
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
}

export const auth = new AuthState();
