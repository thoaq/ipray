import { liveQuery } from 'dexie';
import { db } from './db';
import { requestSync } from './sync';

const OLD_STORAGE_KEY = 'gebetsraum:favoriten';

class FavoritesState {
	activeIds: Set<string> = $state(new Set());

	constructor() {
		if (typeof window === 'undefined') return;
		void this.migrateFromLocalStorage();
		liveQuery(() => db.favorites.filter((f) => !f.deletedAt).toArray()).subscribe({
			next: (rows) => {
				this.activeIds = new Set(rows.map((r) => r.itemId));
			},
			error: (err) => console.error('Konnte Favoriten nicht laden:', err)
		});
	}

	private async migrateFromLocalStorage() {
		const already = await db.favorites.count();
		if (already > 0) return;
		try {
			const raw = window.localStorage.getItem(OLD_STORAGE_KEY);
			if (!raw) return;
			const slugs = JSON.parse(raw) as string[];
			const now = new Date().toISOString();
			await db.favorites.bulkPut(slugs.map((itemId) => ({ itemId, updatedAt: now, dirty: 1 })));
			window.localStorage.removeItem(OLD_STORAGE_KEY);
			requestSync();
		} catch {
			/* keine alten Favoriten vorhanden */
		}
	}

	has(itemId: string): boolean {
		return this.activeIds.has(itemId);
	}

	async toggle(itemId: string) {
		const now = new Date().toISOString();
		const isFavorite = this.activeIds.has(itemId);
		await db.favorites.put({
			itemId,
			updatedAt: now,
			deletedAt: isFavorite ? now : undefined,
			dirty: 1
		});
		requestSync();
	}
}

export const favorites = new FavoritesState();
