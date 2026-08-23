import { supabase } from './supabaseClient';
import { classifyImageRole } from './content/imageRole';
import type { BildRolle } from './content/types';

export interface UploadedImage {
	url: string;
	rolle: BildRolle;
	breite: number;
	hoehe: number;
}

export interface ExistingImageEntry {
	/** Pfad innerhalb des Storage-Buckets, z.B. "userId/dateiname.jpg" — dient als Auswahl-ID. */
	path: string;
	url: string;
}

function readDimensions(file: File): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const objectUrl = URL.createObjectURL(file);
		img.onload = () => {
			resolve({ width: img.naturalWidth, height: img.naturalHeight });
			URL.revokeObjectURL(objectUrl);
		};
		img.onerror = () => {
			URL.revokeObjectURL(objectUrl);
			reject(new Error('Bild konnte nicht gelesen werden.'));
		};
		img.src = objectUrl;
	});
}

function readDimensionsFromUrl(url: string): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
		img.onerror = () => reject(new Error('Bild konnte nicht gelesen werden.'));
		img.src = url;
	});
}

/** Listet die eigenen, bereits hochgeladenen Bilder auf (für die "Vorhandenes Bild wählen"-Galerie). */
export async function listUserImages(userId: string): Promise<ExistingImageEntry[]> {
	if (!supabase) throw new Error('Supabase ist nicht konfiguriert.');
	const { data, error } = await supabase.storage
		.from('prayer-images')
		.list(userId, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
	if (error) throw new Error(error.message);
	return (data ?? [])
		.filter((f) => f.id) // Ordner haben keine id, nur echte Dateien behalten
		.map((f) => {
			const path = `${userId}/${f.name}`;
			const { data: pub } = supabase!.storage.from('prayer-images').getPublicUrl(path);
			return { path, url: pub.publicUrl };
		});
}

/**
 * Übernimmt ein bereits hochgeladenes eigenes Bild für ein anderes Gebet — kopiert es dazu auf
 * den eigenen Pfad dieses Gebets, statt auf den Ursprungspfad zu verlinken. So bleibt jede Fassung
 * unabhängig: Ersetzt oder löscht man später das Quellbild, sind andere Gebete davon nicht betroffen.
 */
export async function copyExistingPrayerImage(
	userId: string,
	prayerId: string,
	sourcePath: string
): Promise<UploadedImage> {
	if (!supabase) throw new Error('Supabase ist nicht konfiguriert.');
	const ext = sourcePath.split('.').pop()?.toLowerCase() || 'jpg';
	const targetPath = `${userId}/${prayerId}.${ext}`;
	if (sourcePath !== targetPath) {
		const { error } = await supabase.storage.from('prayer-images').copy(sourcePath, targetPath);
		if (error) throw new Error(error.message);
	}
	const { data } = supabase.storage.from('prayer-images').getPublicUrl(targetPath);
	const { width, height } = await readDimensionsFromUrl(data.publicUrl);
	return { url: data.publicUrl, rolle: classifyImageRole(width, height), breite: width, hoehe: height };
}

/** Lädt ein Bild in den privaten Ordner der Nutzer:in hoch und klassifiziert die Rolle automatisch. */
export async function uploadPrayerImage(userId: string, prayerId: string, file: File): Promise<UploadedImage> {
	if (!supabase) throw new Error('Supabase ist nicht konfiguriert.');
	const { width, height } = await readDimensions(file);
	const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
	const path = `${userId}/${prayerId}.${ext}`;

	const { error } = await supabase.storage
		.from('prayer-images')
		.upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
	if (error) throw new Error(error.message);

	const { data } = supabase.storage.from('prayer-images').getPublicUrl(path);
	return { url: data.publicUrl, rolle: classifyImageRole(width, height), breite: width, hoehe: height };
}
