import { liveQuery } from 'dexie';
import { db, type LocalCategoryOverride } from './db';
import { requestSync } from './sync';

class CategoryOverridesState {
	items: LocalCategoryOverride[] = $state([]);
	loaded = $state(false);

	constructor() {
		if (typeof window === 'undefined') return;
		liveQuery(() => db.categoryOverrides.filter((c) => !c.deletedAt).toArray()).subscribe({
			next: (rows) => {
				this.items = rows;
				this.loaded = true;
			},
			error: (err) => console.error('Konnte Kategorie-Anpassungen nicht laden:', err)
		});
	}

	get(slug: string): LocalCategoryOverride | undefined {
		return this.items.find((c) => c.slug === slug);
	}

	/** Wendet eine evtl. vorhandene persönliche Anpassung auf Name/Farbschema an. */
	resolve(slug: string, baseName: string, baseSchema: string): { name: string; schema: string } {
		const ov = this.get(slug);
		return {
			name: ov?.displayName?.trim() || baseName,
			schema: ov?.schema || baseSchema
		};
	}

	async set(slug: string, input: { displayName?: string; schema?: string }) {
		await db.categoryOverrides.put({
			slug,
			displayName: input.displayName?.trim() || undefined,
			schema: input.schema || undefined,
			updatedAt: new Date().toISOString(),
			dirty: 1
		});
		requestSync();
	}

	async remove(slug: string) {
		const existing = await db.categoryOverrides.get(slug);
		if (!existing) return;
		await db.categoryOverrides.put({ ...existing, deletedAt: new Date().toISOString(), dirty: 1 });
		requestSync();
	}
}

export const categoryOverrides = new CategoryOverridesState();
