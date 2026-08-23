// Eigenes Modul (statt in sync.ts), damit auth.svelte.ts und sync.ts sich nicht
// gegenseitig importieren müssen.

let paused = false;

export function isSyncPaused(): boolean {
	return paused;
}

/** Während eines Konto-Wechsels pausiert, damit kein zeitgleicher Sync lokale
 *  Reste der alten Identität unter der neuen pusht (siehe auth.svelte.ts). */
export function pauseSync() {
	paused = true;
}

export function resumeSync() {
	paused = false;
}
