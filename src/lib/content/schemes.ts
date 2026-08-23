// Farbschemas pro Kategorie — siehe Konzept, Abschnitt "Ein Farbschema pro Kategorie".
// Jedes Schema hat vier Rollen (accent, accentSoft, wash, line), je mit Hell-/Dunkel-Wert.

export interface SchemeTokens {
	accent: string;
	accentSoft: string;
	wash: string;
	line: string;
}

export interface Scheme {
	key: string;
	name: string;
	light: SchemeTokens;
	dark: SchemeTokens;
}

export const schemes: Record<string, Scheme> = {
	standard: {
		key: 'standard',
		name: 'Tageszeiten (Standard)',
		light: { accent: '#A5732E', accentSoft: '#EADFC5', wash: '#F7F1E4', line: '#D9C79A' },
		dark: { accent: '#D9A94E', accentSoft: '#2E2716', wash: '#211B10', line: '#4A3C1E' }
	},
	marien: {
		key: 'marien',
		name: 'Mariengebete',
		light: { accent: '#2F5E8C', accentSoft: '#D7E4EF', wash: '#EEF3F8', line: '#B9D0E2' },
		dark: { accent: '#7EB3E0', accentSoft: '#1C2E3D', wash: '#141E27', line: '#2C4256' }
	},
	heiligGeist: {
		key: 'heiligGeist',
		name: 'Heilig-Geist-Gebete',
		light: { accent: '#C99A1E', accentSoft: '#F5E7B8', wash: '#FBF6E4', line: '#E6D189' },
		dark: { accent: '#F0C550', accentSoft: '#362B10', wash: '#221B0C', line: '#4F3F16' }
	},
	herzJesu: {
		key: 'herzJesu',
		name: 'Herz-Jesu- & Passionsgebete',
		light: { accent: '#A33B3B', accentSoft: '#F1D9D6', wash: '#FBF0EF', line: '#E3BEBA' },
		dark: { accent: '#E08585', accentSoft: '#3A1F1E', wash: '#251413', line: '#522E2C' }
	},
	fasten: {
		key: 'fasten',
		name: 'Fasten- & Bußgebete',
		light: { accent: '#6B4E8E', accentSoft: '#E4DBEF', wash: '#F5F1FA', line: '#CDBBDE' },
		dark: { accent: '#B79BDB', accentSoft: '#2A2036', wash: '#1A1522', line: '#3E3151' }
	},
	advent: {
		key: 'advent',
		name: 'Advent & Weihnachten',
		light: { accent: '#3E6B52', accentSoft: '#D7E5DC', wash: '#EFF5F1', line: '#B8D0C2' },
		dark: { accent: '#7FBE9C', accentSoft: '#1B2C22', wash: '#131E18', line: '#2C4636' }
	}
};

export const DEFAULT_SCHEME = 'standard';

export function schemeFor(key: string | undefined): Scheme {
	if (key && schemes[key]) return schemes[key];
	return schemes[DEFAULT_SCHEME];
}

/** Setzt die vier CSS-Variablen eines Schemas für den aktuell aktiven Modus (hell/dunkel). */
export function schemeCssVars(scheme: Scheme, isDark: boolean): Record<string, string> {
	const t = isDark ? scheme.dark : scheme.light;
	return {
		'--accent': t.accent,
		'--accent-soft': t.accentSoft,
		'--accent-wash': t.wash,
		'--accent-line': t.line
	};
}
