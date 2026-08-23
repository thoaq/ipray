// Kategorie -> Farbschema. Kategorien, die hier nicht gelistet sind, fallen automatisch
// auf das Standard-Schema zurück (siehe Konzept: "Standard-Schema als Rückfall").

export interface CategoryConfig {
	slug: string;
	schema: string;
}

export const categoryConfig: Record<string, CategoryConfig> = {
	Mariengebete: { slug: 'mariengebete', schema: 'marien' },
	'Heilig-Geist-Gebete': { slug: 'heilig-geist-gebete', schema: 'heiligGeist' },
	'Herz-Jesu- & Passionsgebete': { slug: 'herz-jesu-passionsgebete', schema: 'herzJesu' },
	'Fasten- & Bußgebete': { slug: 'fasten-bussgebete', schema: 'fasten' },
	'Advent & Weihnachten': { slug: 'advent-weihnachten', schema: 'advent' },
	Tageszeiten: { slug: 'tageszeiten', schema: 'standard' }
};

export function slugify(value: string): string {
	return value
		.toLowerCase()
		.replaceAll('ä', 'ae')
		.replaceAll('ö', 'oe')
		.replaceAll('ü', 'ue')
		.replaceAll('ß', 'ss')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export function configFor(kategorie: string): CategoryConfig {
	return categoryConfig[kategorie] ?? { slug: slugify(kategorie), schema: 'standard' };
}
