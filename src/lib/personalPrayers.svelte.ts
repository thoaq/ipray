import { liveQuery } from 'dexie';
import { db, type LocalPrayer } from './db';
import { requestSync } from './sync';
import { auth } from './auth.svelte';
import { uploadPrayerImage } from './imageUpload';
import type { BildPosition } from './content/types';

class PersonalPrayersState {
	items: LocalPrayer[] = $state([]);
	loaded = $state(false);

	constructor() {
		if (typeof window === 'undefined') return;
		liveQuery(() => db.prayers.filter((p) => !p.deletedAt).toArray()).subscribe({
			next: (rows) => {
				this.items = rows.sort((a, b) => a.titel.localeCompare(b.titel, 'de'));
				this.loaded = true;
			},
			error: (err) => console.error('Konnte eigene Gebete nicht laden:', err)
		});
	}

	byId(id: string): LocalPrayer | undefined {
		return this.items.find((p) => p.id === id);
	}

	async add(input: {
		titel: string;
		kategorie: string;
		unterkategorie?: string;
		tags: string[];
		quelle?: string;
		bodyText: string;
		imageFile?: File;
		bildPosition?: BildPosition;
	}): Promise<string> {
		// Ohne verbundenes Supabase-Projekt bleibt alles rein lokal auf diesem Gerät;
		// 'local' wird beim späteren Verbinden durch die echte Nutzer-ID ersetzt (siehe sync.ts).
		const userId = auth.userId ?? 'local';
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		// Bild-Upload braucht ein verbundenes, angemeldetes Konto (Storage-Policies greifen
		// pro Nutzer-ID) — ohne das wird das Gebet trotzdem gespeichert, nur ohne Bild.
		const image =
			input.imageFile && auth.userId ? await uploadPrayerImage(auth.userId, id, input.imageFile) : undefined;

		await db.prayers.put({
			id,
			userId,
			titel: input.titel,
			kategorie: input.kategorie,
			unterkategorie: input.unterkategorie || undefined,
			tags: input.tags,
			sprache: 'de',
			quelle: input.quelle || undefined,
			bodyText: input.bodyText,
			bildUrl: image?.url,
			bildRolle: image?.rolle,
			bildBreite: image?.breite,
			bildHoehe: image?.hoehe,
			bildPosition: image ? (input.bildPosition ?? 'auto') : undefined,
			updatedAt: now,
			dirty: 1
		});
		requestSync();
		return id;
	}

	async remove(id: string) {
		const existing = await db.prayers.get(id);
		if (!existing) return;
		await db.prayers.put({ ...existing, deletedAt: new Date().toISOString(), dirty: 1 });
		requestSync();
	}
}

export const personalPrayers = new PersonalPrayersState();
