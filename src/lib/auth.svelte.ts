import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './supabaseClient';
import { db } from './db';
import { pauseSync, resumeSync } from './syncControl';

// Zugang über Einladungslink: anonyme Anmeldung ohne Passwort/E-Mail (siehe Konzept,
// Architektur Schicht 2). Der "Wiederherstellungs-Code" für ein zweites Gerät ist
// bewusst einfach gehalten: der Supabase-Refresh-Token selbst, den man auf dem neuen
// Gerät einträgt, um dieselbe Sitzung wiederherzustellen — kein eigener Server-Baustein
// nötig, robuster als ein selbst gebautes Token-System.

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
		});

		supabase.auth.getSession().then(({ data }) => {
			if (data.session) {
				this.session = data.session;
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
		else this.session = data.session;
		this.ready = true;
	}

	/** Der Code, den man sich merken/kopieren muss, um dieses Konto auf einem neuen Gerät zu öffnen. */
	get recoveryCode(): string | null {
		return this.session?.refresh_token ?? null;
	}

	async restoreOnThisDevice(code: string): Promise<{ ok: boolean; error?: string }> {
		if (!supabase) return { ok: false, error: 'Supabase ist noch nicht konfiguriert.' };
		const trimmed = code.trim();
		if (!trimmed) return { ok: false, error: 'Bitte einen Code eingeben.' };

		// Vorher merken: refreshSession() löst den onAuthStateChange-Listener bereits
		// während des Aufrufs aus, der this.session sonst zu früh auf die neue Identität
		// umstellen würde. Sync bleibt bis zum Aufräumen pausiert, damit kein zeitgleicher
		// Sync-Lauf lokale Reste der alten Identität unter der neuen Identität pusht.
		const previousUserId = this.session?.user?.id;
		pauseSync();
		try {
			const { data, error } = await supabase.auth.refreshSession({ refresh_token: trimmed });
			if (error || !data.session) {
				return { ok: false, error: error?.message ?? 'Code ungültig oder abgelaufen.' };
			}

			if (previousUserId && previousUserId !== data.session.user.id) {
				await Promise.all([db.prayers.clear(), db.favorites.clear(), db.syncMeta.clear()]);
			}

			this.session = data.session;
			return { ok: true };
		} finally {
			resumeSync();
		}
	}
}

export const auth = new AuthState();
