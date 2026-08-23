import { liveQuery } from 'dexie';
import { db, type LocalPrayer } from './db';
import { requestSync } from './sync';
import { auth } from './auth.svelte';
import { uploadPrayerImage, copyExistingPrayerImage } from './imageUpload';
import type { BildPosition, BildRolle } from './content/types';

export interface PrayerFormInput {
	titel: string;
	kategorie: string;
	unterkategorie?: string;
	tags: string[];
	quelle?: string;
	bodyText: string;
	imageFile?: File;
	/** Pfad eines bereits hochgeladenen eigenen Bildes, das für dieses Gebet übernommen (kopiert) werden soll. */
	existingImagePath?: string;
	/** Mitgeliefertes Farbschema-Banner (statisches Asset) — wird direkt referenziert, kein Upload/Kopieren nötig. */
	bannerImage?: { url: string; rolle: BildRolle; breite: number; hoehe: number };
	bildPosition?: BildPosition;
	/** Entfernt ein vorhandenes Bild, wenn keine neue Datei gewählt wurde (nur beim Bearbeiten relevant). */
	removeImage?: boolean;
	/** Übernimmt ein bereits vorhandenes Bild unverändert (z.B. das Bild eines mitgelieferten
	 *  Gebets beim Anlegen einer eigenen Fassung) — spart einen unnötigen Re-Upload. */
	existingImage?: { url: string; rolle: BildRolle; breite: number; hoehe: number };
	/** Slug des mitgelieferten Gebets, das diese eigene Fassung für die Person ersetzt. */
	overridesSlug?: string;
}

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

	/** Die eigene Fassung eines mitgelieferten Gebets, falls für diesen Slug bereits eine existiert. */
	byOverriddenSlug(slug: string): LocalPrayer | undefined {
		return this.items.find((p) => p.overridesSlug === slug);
	}

	async add(input: PrayerFormInput): Promise<string> {
		// Ohne verbundenes Supabase-Projekt bleibt alles rein lokal auf diesem Gerät;
		// 'local' wird beim späteren Verbinden durch die echte Nutzer-ID ersetzt (siehe sync.ts).
		const userId = auth.userId ?? 'local';
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		// Bild-Upload braucht ein verbundenes, angemeldetes Konto (Storage-Policies greifen
		// pro Nutzer-ID) — ohne das wird das Gebet trotzdem gespeichert, nur ohne Bild.
		// existingImage übernimmt z.B. das Bild eines mitgelieferten Gebets unverändert,
		// ohne es erneut hochzuladen.
		const image =
			input.imageFile && auth.userId
				? await uploadPrayerImage(auth.userId, id, input.imageFile)
				: input.existingImagePath && auth.userId
					? await copyExistingPrayerImage(auth.userId, id, input.existingImagePath)
					: (input.bannerImage ?? input.existingImage);

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
			overridesSlug: input.overridesSlug,
			updatedAt: now,
			dirty: 1
		});
		requestSync();
		return id;
	}

	async update(id: string, input: PrayerFormInput): Promise<void> {
		const existing = await db.prayers.get(id);
		if (!existing) throw new Error('Gebet nicht gefunden.');
		const now = new Date().toISOString();

		const image =
			input.imageFile && auth.userId
				? await uploadPrayerImage(auth.userId, id, input.imageFile)
				: input.existingImagePath && auth.userId
					? await copyExistingPrayerImage(auth.userId, id, input.existingImagePath)
					: input.bannerImage;
		const keepExistingImage =
			!input.imageFile && !input.existingImagePath && !input.bannerImage && !input.removeImage;

		await db.prayers.put({
			...existing,
			titel: input.titel,
			kategorie: input.kategorie,
			unterkategorie: input.unterkategorie || undefined,
			tags: input.tags,
			quelle: input.quelle || undefined,
			bodyText: input.bodyText,
			bildUrl: keepExistingImage ? existing.bildUrl : image?.url,
			bildRolle: keepExistingImage ? existing.bildRolle : image?.rolle,
			bildBreite: keepExistingImage ? existing.bildBreite : image?.breite,
			bildHoehe: keepExistingImage ? existing.bildHoehe : image?.hoehe,
			bildPosition: keepExistingImage
				? existing.bildPosition
				: image
					? (input.bildPosition ?? 'auto')
					: undefined,
			updatedAt: now,
			dirty: 1
		});
		requestSync();
	}

	async remove(id: string) {
		const existing = await db.prayers.get(id);
		if (!existing) return;
		await db.prayers.put({ ...existing, deletedAt: new Date().toISOString(), dirty: 1 });
		requestSync();
	}
}

export const personalPrayers = new PersonalPrayersState();
