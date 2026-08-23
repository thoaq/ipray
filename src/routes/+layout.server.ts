import { loadPrayers } from '$lib/content/prayers.server';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const { prayers, categories } = await loadPrayers();
	return { prayers, categories };
};
