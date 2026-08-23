<script lang="ts">
	import { schemes } from '$lib/content/schemes';
	import { configFor } from '$lib/content/categories';
	import { theme } from '$lib/theme.svelte';
	import { personalPrayers } from '$lib/personalPrayers.svelte';
	import { categoryOverrides } from '$lib/categoryOverrides.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function dotColor(schemaKey: string): string {
		const s = schemes[schemaKey] ?? schemes.standard;
		return theme.isDark ? s.dark.accent : s.light.accent;
	}

	// Slugs mitgelieferter Gebete, für die eine eigene Fassung existiert — die zählen/
	// erscheinen dann über ihre eigene Fassung, nicht (zusätzlich) über das Original.
	const overriddenSlugs = $derived(
		new Set(personalPrayers.items.filter((p) => p.overridesSlug).map((p) => p.overridesSlug))
	);

	// Kuratierte Kategorien (server-geladen) + eigene Gebete (clientseitig aus Dexie) zusammenführen.
	const categories = $derived.by(() => {
		const bySlug = new Map(data.categories.map((c) => [c.slug, { ...c }]));
		// Überschriebene mitgelieferte Gebete nicht mehr bei ihrer ursprünglichen Kategorie zählen …
		for (const p of data.prayers) {
			if (!overriddenSlugs.has(p.slug)) continue;
			const entry = bySlug.get(p.kategorieSlug);
			if (entry) entry.count -= 1;
		}
		// … sondern (wie jedes eigene Gebet) bei ihrer aktuellen Kategorie.
		for (const p of personalPrayers.items) {
			const cfg = configFor(p.kategorie);
			const existing = bySlug.get(cfg.slug);
			if (existing) existing.count += 1;
			else bySlug.set(cfg.slug, { name: p.kategorie, slug: cfg.slug, schema: cfg.schema, count: 1 });
		}
		return [...bySlug.values()]
			.filter((c) => c.count > 0)
			.map((c) => ({ ...c, ...categoryOverrides.resolve(c.slug, c.name, c.schema) }))
			.sort((a, b) => a.name.localeCompare(b.name, 'de'));
	});

	// Ebenso Tags aus kuratierten und eigenen Gebeten zusammenführen, mit Häufigkeit —
	// überschriebene Originale liefern ihre Tags nicht mehr mit, die eigene Fassung schon.
	const tags = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const p of data.prayers) {
			if (overriddenSlugs.has(p.slug)) continue;
			for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
		}
		for (const p of personalPrayers.items) {
			for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
		}
		return [...counts.entries()]
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => a.name.localeCompare(b.name, 'de'));
	});
</script>

<svelte:head>
	<title>Gebetsraum</title>
</svelte:head>

<div class="page">
	<header class="hero">
		<h1>Deine Gebete</h1>
		<p class="lede">Kategorien, in denen deine Gebete geordnet sind. Alles hier ist auch offline verfügbar.</p>
	</header>

	<ul class="cat-list">
		{#each categories as cat (cat.slug)}
			<li>
				<a href="/kategorie/{cat.slug}">
					<span class="dot" style="background:{dotColor(cat.schema)}"></span>
					<span class="name">{cat.name}</span>
					<span class="count">{cat.count}</span>
				</a>
			</li>
		{/each}
	</ul>

	{#if tags.length}
		<section class="tags-section">
			<h2>Tags</h2>
			<div class="tag-cloud">
				{#each tags as t (t.name)}
					<a class="tag-chip" href="/tag/{encodeURIComponent(t.name)}">
						{t.name}
						<span class="tag-count">{t.count}</span>
					</a>
				{/each}
			</div>
		</section>
	{/if}
</div>

<style>
	.page {
		max-width: var(--content-max);
		margin: 0 auto;
		padding: clamp(2rem, 5vw, 3.5rem) clamp(1.1rem, 4vw, 1.5rem) 4rem;
	}

	.hero {
		margin-bottom: 2rem;
	}

	.hero h1 {
		font-size: clamp(1.9rem, 5vw, 2.5rem);
	}

	.lede {
		margin: 0.6rem 0 0;
		color: var(--ink-soft);
		max-width: 42ch;
	}

	.cat-list {
		list-style: none;
		margin: 0;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: 12px;
		overflow: hidden;
		background: var(--paper-raised);
		box-shadow: var(--shadow);
	}

	.cat-list li + li {
		border-top: 1px solid var(--line);
	}

	.cat-list a {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.85rem 1.1rem;
		text-decoration: none;
		color: var(--ink);
	}

	.cat-list a:hover {
		background: var(--accent-wash);
	}

	.dot {
		width: 11px;
		height: 11px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.name {
		flex: 1;
		font-size: 1rem;
	}

	.count {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--ink-faint);
	}

	.tags-section {
		margin-top: 2.4rem;
	}

	.tags-section h2 {
		font-size: 1.05rem;
		margin-bottom: 0.9rem;
	}

	.tag-cloud {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
	}

	.tag-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.85rem;
		background: var(--accent-soft);
		color: var(--ink);
		border: 1px solid var(--accent-line);
		border-radius: 999px;
		padding: 0.35rem 0.8rem;
		text-decoration: none;
	}

	.tag-chip:hover {
		background: var(--accent-wash);
		border-color: var(--accent);
	}

	.tag-count {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--ink-faint);
	}
</style>
