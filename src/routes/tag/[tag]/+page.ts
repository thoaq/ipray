import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
	const { prayers } = await parent();
	const tag = decodeURIComponent(params.tag);
	const items = prayers.filter((p) => p.tags.includes(tag));
	return { tag, items };
};
