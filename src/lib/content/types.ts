export type BildRolle = 'bannerBreit' | 'bannerHoch' | 'bild';
export type BildPosition = 'auto' | 'neben' | 'oben' | 'unten';

export interface PrayerImage {
	src: string;
	rolle: BildRolle;
	position: BildPosition;
	breite: number;
	hoehe: number;
}

export interface Prayer {
	slug: string;
	titel: string;
	kategorie: string;
	kategorieSlug: string;
	unterkategorie?: string;
	tags: string[];
	quelle?: string;
	sprache: string;
	schema: string;
	image?: PrayerImage;
	bodyHtml: string;
	bodyText: string;
}

export interface CategorySummary {
	name: string;
	slug: string;
	schema: string;
	count: number;
}
