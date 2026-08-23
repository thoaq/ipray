import { supabase } from './supabaseClient';
import { classifyImageRole } from './content/imageRole';
import type { BildRolle } from './content/types';

export interface UploadedImage {
	url: string;
	rolle: BildRolle;
	breite: number;
	hoehe: number;
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
