import type { PageLoad } from './$types';

// Eigene Gebete liegen nur clientseitig in Dexie (Schicht 3) und lassen sich hier
// nicht laden — das übernimmt +page.svelte reaktiv über personalPrayers.
// Wird hier nichts Kuratiertes gefunden, entscheidet die Komponente anhand von
// personalPrayers, ob es ein eigenes Gebet ist oder wirklich nicht existiert.
export const load: PageLoad = async ({ params, parent }) => {
	const { prayers, categories } = await parent();
	const prayer = prayers.find((p) => p.slug === params.slug);
	const category = prayer ? categories.find((c) => c.slug === prayer.kategorieSlug) : undefined;
	return { prayer, category, categories, slug: params.slug };
};
