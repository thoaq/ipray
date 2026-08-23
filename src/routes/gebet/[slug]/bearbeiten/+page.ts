import type { PageLoad } from './$types';

// Kuratiertes Gebet (falls vorhanden) mitladen — es dient als Vorlage, wenn noch keine
// eigene Fassung existiert (siehe +page.svelte: Bearbeiten legt dann eine Fassung an).
export const load: PageLoad = async ({ params, parent }) => {
	const { prayers, categories } = await parent();
	const curated = prayers.find((p) => p.slug === params.slug);
	return { slug: params.slug, categories, curated };
};
