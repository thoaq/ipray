import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { imageSizeFromFile } from 'image-size/fromFile';
import { configFor } from './categories';
import { classifyImageRole } from './imageRole';
import type { BildPosition, CategorySummary, Prayer } from './types';

// Markdown-Dateien werden zur Build-/Dev-Zeit eingelesen (Content-Pipeline aus dem Konzept).
const files = import.meta.glob('./prayers/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<
	string,
	string
>;

const STATIC_PRAYERS_DIR = path.resolve(process.cwd(), 'static', 'prayers');

async function resolveImage(
	filename: string | undefined,
	positionRaw: string | undefined
): Promise<Prayer['image']> {
	if (!filename) return undefined;
	const { width, height } = await imageSizeFromFile(path.join(STATIC_PRAYERS_DIR, filename));
	if (!width || !height) return undefined;
	const rolle = classifyImageRole(width, height);
	const position: BildPosition =
		positionRaw === 'neben' || positionRaw === 'oben' || positionRaw === 'unten' ? positionRaw : 'auto';
	return { src: `/prayers/${filename}`, rolle, position, breite: width, hoehe: height };
}

let cache: { prayers: Prayer[]; categories: CategorySummary[] } | null = null;

export async function loadPrayers(): Promise<{ prayers: Prayer[]; categories: CategorySummary[] }> {
	if (cache) return cache;

	const prayers: Prayer[] = [];
	for (const [filepath, raw] of Object.entries(files)) {
		const slug = path.basename(filepath, '.md');
		const { data, content } = matter(raw);
		const cfg = configFor(data.kategorie as string);
		const image = await resolveImage(data.bild as string | undefined, data.bild_position as string | undefined);

		prayers.push({
			slug,
			titel: data.titel ?? slug,
			kategorie: data.kategorie ?? 'Ohne Kategorie',
			kategorieSlug: cfg.slug,
			unterkategorie: data.unterkategorie,
			tags: Array.isArray(data.tags) ? data.tags : [],
			quelle: data.quelle,
			sprache: data.sprache ?? 'de',
			schema: cfg.schema,
			image,
			bodyHtml: await marked.parse(content.trim()),
			bodyText: content.trim()
		});
	}

	prayers.sort((a, b) => a.titel.localeCompare(b.titel, 'de'));

	const bySlug = new Map<string, CategorySummary>();
	for (const p of prayers) {
		const existing = bySlug.get(p.kategorieSlug);
		if (existing) existing.count += 1;
		else bySlug.set(p.kategorieSlug, { name: p.kategorie, slug: p.kategorieSlug, schema: p.schema, count: 1 });
	}
	const categories = [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));

	cache = { prayers, categories };
	return cache;
}
