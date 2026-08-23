import Dexie, { type Table } from 'dexie';
import type { BildPosition, BildRolle } from './content/types';

// Lokaler Cache der persönlichen Ebene (Schicht 2/3 aus dem Konzept).
// `dirty` markiert Zeilen mit lokalen Änderungen, die noch nicht nach Supabase
// gepusht wurden; `deletedAt` ist ein Soft-Delete-Tombstone, damit Löschungen
// zwischen Geräten mit-synchronisiert werden statt lokal einfach zu verschwinden.

export interface LocalPrayer {
	id: string;
	userId: string;
	titel: string;
	kategorie: string;
	unterkategorie?: string;
	tags: string[];
	sprache: string;
	quelle?: string;
	bodyText: string;
	bildUrl?: string;
	bildRolle?: BildRolle;
	bildBreite?: number;
	bildHoehe?: number;
	bildPosition?: BildPosition;
	/** Gesetzt, wenn dies die eigene, bearbeitete Fassung eines mitgelieferten Gebets ist —
	 *  der Wert ist der Slug des Originals, das dadurch für diese Person ersetzt wird. */
	overridesSlug?: string;
	updatedAt: string;
	deletedAt?: string;
	dirty: 0 | 1;
}

export interface LocalFavorite {
	itemId: string;
	updatedAt: string;
	deletedAt?: string;
	dirty: 0 | 1;
}

export interface SyncMeta {
	key: string;
	lastPulledAt: string;
}

/** Persönliche Anpassung einer Kategorie (Name/Farbschema) — überschreibt nur die
 *  Anzeige für den gegebenen Slug, rührt nicht an den Gebeten selbst. */
export interface LocalCategoryOverride {
	slug: string;
	displayName?: string;
	schema?: string;
	updatedAt: string;
	deletedAt?: string;
	dirty: 0 | 1;
}

class GebetsraumDB extends Dexie {
	prayers!: Table<LocalPrayer, string>;
	favorites!: Table<LocalFavorite, string>;
	syncMeta!: Table<SyncMeta, string>;
	categoryOverrides!: Table<LocalCategoryOverride, string>;

	constructor() {
		super('gebetsraum');
		this.version(1).stores({
			prayers: 'id, userId, updatedAt, dirty',
			favorites: 'itemId, updatedAt, dirty',
			syncMeta: 'key'
		});
		this.version(2).stores({
			prayers: 'id, userId, updatedAt, dirty',
			favorites: 'itemId, updatedAt, dirty',
			syncMeta: 'key',
			categoryOverrides: 'slug, updatedAt, dirty'
		});
	}
}

export const db = new GebetsraumDB();
