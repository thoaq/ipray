import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
	const { categories } = await parent();
	const base = categories.find((c) => c.slug === params.slug);
	return { slug: params.slug, base };
};
