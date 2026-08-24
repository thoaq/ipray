import { supabase, supabaseConfigured } from './supabaseClient';
import { db } from './db';
import { auth } from './auth.svelte';
import { isSyncPaused, pauseSync, resumeSync } from './syncControl';

// Push/Pull-Sync zwischen dem lokalen Cache (Dexie/IndexedDB) und Supabase.
// Kein Echtzeit-Abgleich nötig — nur eine Person schreibt je ihre eigenen Zeilen,
// darum reicht "neuester Zeitstempel gewinnt" beim Zusammenführen (siehe Konzept).

const EPOCH = '1970-01-01T00:00:00.000Z';

let syncing = false;
let pendingRerun = false;

export function requestSync() {
	if (typeof window === 'undefined' || isSyncPaused()) return;
	void runSync();
}

/** Lädt zuerst alle lokal noch nicht hochgeladenen Änderungen hoch, leert danach den
 *  kompletten lokalen Cache (nicht nur den Pull-Cursor) und baut ihn frisch vom Server auf.
 *  Nötig für zwei verschiedene Arten von "hängen gebliebenen" Zuständen: (1) eine Zeile mit
 *  altem `updated_at`, die erst nachträglich erfolgreich gepusht wurde (z. B. weil ein Push
 *  zuvor an RLS scheiterte) — der reguläre inkrementelle Pull (`gt('updated_at', since)`)
 *  würde sie für immer überspringen, da der Cursor auf anderen Geräten längst weiter steht;
 *  (2) lokale Zeilen, die serverseitig gar nicht mehr existieren (z. B. nach einer manuellen
 *  Datenbereinigung/Konten-Zusammenführung per SQL ohne Tombstone) — ein reiner
 *  Cursor-Reset lässt solche Karteileichen unangetastet, weil Pull nur hinzufügt/aktualisiert,
 *  nie von sich aus lokal löscht. Das vollständige Leeren der Tabellen behebt beides. */
export async function forceFullResync() {
	if (!supabaseConfigured || !supabase) return;
	const userId = auth.userId;
	if (!userId) return;
	pauseSync();
	try {
		await pushPrayers(userId);
		await pushFavorites(userId);
		await pushCategoryOverrides(userId);
		await Promise.all([db.prayers.clear(), db.favorites.clear(), db.categoryOverrides.clear()]);
		await db.syncMeta.clear();
	} finally {
		resumeSync();
	}
	requestSync();
}

async function runSync() {
	if (syncing) {
		pendingRerun = true;
		return;
	}
	syncing = true;
	try {
		await syncNow();
	} catch (err) {
		console.error('Sync fehlgeschlagen:', err);
	} finally {
		syncing = false;
		if (pendingRerun && !isSyncPaused()) {
			pendingRerun = false;
			void runSync();
		}
	}
}

async function syncNow() {
	if (!supabaseConfigured || !supabase) return;
	if (!navigator.onLine) return;
	const userId = auth.userId;
	if (!userId) return;

	await pushPrayers(userId);
	await pushFavorites(userId);
	await pushCategoryOverrides(userId);
	await pullPrayers(userId);
	await pullFavorites(userId);
	await pullCategoryOverrides(userId);
}

async function pushPrayers(userId: string) {
	if (!supabase) return;
	const dirty = await db.prayers.where('dirty').equals(1).toArray();
	for (const p of dirty) {
		const { error } = await supabase.from('prayers').upsert({
			id: p.id,
			user_id: userId,
			titel: p.titel,
			kategorie: p.kategorie,
			unterkategorie: p.unterkategorie ?? null,
			tags: p.tags,
			sprache: p.sprache,
			quelle: p.quelle ?? null,
			body_text: p.bodyText,
			bild_url: p.bildUrl ?? null,
			bild_rolle: p.bildRolle ?? null,
			bild_breite: p.bildBreite ?? null,
			bild_hoehe: p.bildHoehe ?? null,
			bild_position: p.bildPosition ?? 'auto',
			overrides_slug: p.overridesSlug ?? null,
			updated_at: p.updatedAt,
			deleted_at: p.deletedAt ?? null
		});
		if (error) console.error('Push (prayers) fehlgeschlagen:', error.message);
		else await db.prayers.update(p.id, { dirty: 0 });
	}
}

async function pushFavorites(userId: string) {
	if (!supabase) return;
	const dirty = await db.favorites.where('dirty').equals(1).toArray();
	for (const f of dirty) {
		const { error } = await supabase.from('favorites').upsert({
			user_id: userId,
			item_id: f.itemId,
			updated_at: f.updatedAt,
			deleted_at: f.deletedAt ?? null
		});
		if (error) console.error('Push (favorites) fehlgeschlagen:', error.message);
		else await db.favorites.update(f.itemId, { dirty: 0 });
	}
}

async function pushCategoryOverrides(userId: string) {
	if (!supabase) return;
	const dirty = await db.categoryOverrides.where('dirty').equals(1).toArray();
	for (const c of dirty) {
		const { error } = await supabase.from('category_overrides').upsert({
			user_id: userId,
			slug: c.slug,
			display_name: c.displayName ?? null,
			schema: c.schema ?? null,
			updated_at: c.updatedAt,
			deleted_at: c.deletedAt ?? null
		});
		if (error) console.error('Push (category_overrides) fehlgeschlagen:', error.message);
		else await db.categoryOverrides.update(c.slug, { dirty: 0 });
	}
}

async function pullPrayers(userId: string) {
	if (!supabase) return;
	const meta = await db.syncMeta.get('prayers');
	const since = meta?.lastPulledAt ?? EPOCH;
	const { data, error } = await supabase
		.from('prayers')
		.select('*')
		.eq('user_id', userId)
		.gt('updated_at', since)
		.order('updated_at', { ascending: true });
	if (error) {
		console.error('Pull fehlgeschlagen:', error.message);
		return;
	}
	if (!data?.length) return;

	for (const r of data) {
		await db.prayers.put({
			id: r.id,
			userId: r.user_id,
			titel: r.titel,
			kategorie: r.kategorie,
			unterkategorie: r.unterkategorie ?? undefined,
			tags: r.tags ?? [],
			sprache: r.sprache,
			quelle: r.quelle ?? undefined,
			bodyText: r.body_text,
			bildUrl: r.bild_url ?? undefined,
			bildRolle: r.bild_rolle ?? undefined,
			bildBreite: r.bild_breite ?? undefined,
			bildHoehe: r.bild_hoehe ?? undefined,
			bildPosition: r.bild_position ?? 'auto',
			overridesSlug: r.overrides_slug ?? undefined,
			updatedAt: r.updated_at,
			deletedAt: r.deleted_at ?? undefined,
			dirty: 0
		});
	}
	const newest = data.at(-1)?.updated_at;
	if (newest) await db.syncMeta.put({ key: 'prayers', lastPulledAt: newest });
}

async function pullFavorites(userId: string) {
	if (!supabase) return;
	const meta = await db.syncMeta.get('favorites');
	const since = meta?.lastPulledAt ?? EPOCH;
	const { data, error } = await supabase
		.from('favorites')
		.select('*')
		.eq('user_id', userId)
		.gt('updated_at', since)
		.order('updated_at', { ascending: true });
	if (error) {
		console.error('Pull fehlgeschlagen:', error.message);
		return;
	}
	if (!data?.length) return;

	for (const r of data) {
		await db.favorites.put({
			itemId: r.item_id,
			updatedAt: r.updated_at,
			deletedAt: r.deleted_at ?? undefined,
			dirty: 0
		});
	}
	const newest = data.at(-1)?.updated_at;
	if (newest) await db.syncMeta.put({ key: 'favorites', lastPulledAt: newest });
}

async function pullCategoryOverrides(userId: string) {
	if (!supabase) return;
	const meta = await db.syncMeta.get('categoryOverrides');
	const since = meta?.lastPulledAt ?? EPOCH;
	const { data, error } = await supabase
		.from('category_overrides')
		.select('*')
		.eq('user_id', userId)
		.gt('updated_at', since)
		.order('updated_at', { ascending: true });
	if (error) {
		console.error('Pull fehlgeschlagen:', error.message);
		return;
	}
	if (!data?.length) return;

	for (const r of data) {
		await db.categoryOverrides.put({
			slug: r.slug,
			displayName: r.display_name ?? undefined,
			schema: r.schema ?? undefined,
			updatedAt: r.updated_at,
			deletedAt: r.deleted_at ?? undefined,
			dirty: 0
		});
	}
	const newest = data.at(-1)?.updated_at;
	if (newest) await db.syncMeta.put({ key: 'categoryOverrides', lastPulledAt: newest });
}
