// Mitgelieferte Mosaik-Banner, ein Paar (breit/hoch) je Farbschema — siehe Konzept:
// vierte Bildquelle neben Upload und Bild-Wiederverwendung, aber ohne Supabase-Abhängigkeit,
// da rein statische, mit der App ausgelieferte Assets (static/schemes/*.svg).
// Erzeugt mit dem "Facetten"-Stil, Details siehe scratchpad-Generator dieser Session.

import { schemes } from './schemes';
import type { BildRolle } from './types';

export interface SchemeBannerVariant {
	url: string;
	rolle: BildRolle;
	breite: number;
	hoehe: number;
}

export interface SchemeBanner {
	key: string;
	name: string;
	breit: SchemeBannerVariant;
	hoch: SchemeBannerVariant;
}

function fileSlug(key: string): string {
	return key.replace(/([A-Z])/g, '-$1').toLowerCase();
}

export const schemeBanners: SchemeBanner[] = Object.values(schemes).map((scheme) => {
	const slug = fileSlug(scheme.key);
	return {
		key: scheme.key,
		name: scheme.name,
		breit: { url: `/schemes/${slug}-breit.svg`, rolle: 'bannerBreit', breite: 1600, hoehe: 400 },
		hoch: { url: `/schemes/${slug}-hoch.svg`, rolle: 'bannerHoch', breite: 500, hoehe: 1250 }
	};
});
