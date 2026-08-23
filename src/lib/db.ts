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

class GebetsraumDB extends Dexie {
	prayers!: Table<LocalPrayer, string>;
	favorites!: Table<LocalFavorite, string>;
	syncMeta!: Table<SyncMeta, string>;

	constructor() {
		super('gebetsraum');
		this.version(1).stores({
			prayers: 'id, userId, updatedAt, dirty',
			favorites: 'itemId, updatedAt, dirty',
			syncMeta: 'key'
		});
	}
}

export const db = new GebetsraumDB();
