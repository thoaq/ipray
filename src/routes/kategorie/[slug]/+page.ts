import type { PageLoad } from './$types';

// Kein 404 mehr bei unbekanntem Slug: eine Kategorie kann inzwischen auch nur aus
// eigenen (clientseitig in Dexie liegenden) Gebeten bestehen — das löst +page.svelte auf.
export const load: PageLoad = async ({ params, parent }) => {
	const { prayers, categories } = await parent();
	const category = categories.find((c) => c.slug === params.slug);
	const items = prayers.filter((p) => p.kategorieSlug === params.slug);
	return { category, items, slug: params.slug };
};
