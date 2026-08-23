<script lang="ts">
	import MiniSearch from 'minisearch';
	import { configFor } from '$lib/content/categories';
	import { personalPrayers } from '$lib/personalPrayers.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let mini = $state<MiniSearch | null>(null);
	$effect(() => {
		const index = new MiniSearch({
			fields: ['titel', 'bodyText', 'tagsText', 'kategorie'],
			storeFields: ['titel', 'kategorie', 'kategorieSlug', 'slug', 'tags']
		});
		const curated = data.prayers.map((p) => ({ id: p.slug, ...p, tagsText: p.tags.join(' ') }));
		const own = personalPrayers.items.map((p) => {
			const cfg = configFor(p.kategorie);
			return {
				id: p.id,
				slug: p.id,
				titel: p.titel,
				kategorie: p.kategorie,
				kategorieSlug: cfg.slug,
				tags: p.tags,
				bodyText: p.bodyText,
				tagsText: p.tags.join(' ')
			};
		});
		index.addAll([...curated, ...own]);
		mini = index;
	});

	let query = $state('');
	const results = $derived(query.trim().length >= 2 ? (mini?.search(query, { prefix: true, fuzzy: 0.2 }) ?? []) : []);
</script>

<svelte:head>
	<title>Suche · Gebetsraum</title>
</svelte:head>

<div class="page">
	<a class="back" href="/">← Alle Kategorien</a>
	<h1>Suche</h1>
	<input
		type="search"
		placeholder="Gebet, Kategorie oder Tag suchen…"
		bind:value={query}
		class="search-input"
	/>

	{#if query.trim().length >= 2}
		{#if results.length}
			<ul class="results">
				{#each results as r (r.id)}
					<li>
						<a href="/gebet/{r.slug}">
							<span class="title">{r.titel}</span>
							<span class="meta">{r.kategorie}{#if r.tags?.length} · {r.tags.join(', ')}{/if}</span>
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty">Keine Gebete gefunden für „{query}".</p>
		{/if}
	{:else}
		<p class="empty">Mindestens zwei Zeichen eingeben — die Suche funktioniert komplett offline.</p>
	{/if}
</div>

<style>
	.page {
		max-width: var(--content-max);
		margin: 0 auto;
		padding: clamp(2rem, 5vw, 3.5rem) clamp(1.1rem, 4vw, 1.5rem) 4rem;
	}
	.back {
		display: inline-block;
		font-size: 0.85rem;
		color: var(--ink-faint);
		text-decoration: none;
		margin-bottom: 1.3rem;
	}
	.back:hover {
		color: var(--ink);
	}
	h1 {
		font-size: clamp(1.8rem, 5vw, 2.3rem);
		margin-bottom: 1.2rem;
	}
	.search-input {
		width: 100%;
		font: inherit;
		font-size: 1.05rem;
		padding: 0.75rem 1rem;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--paper-raised);
		color: var(--ink);
		margin-bottom: 1.5rem;
	}
	.search-input:focus {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.empty {
		color: var(--ink-faint);
		font-size: 0.92rem;
	}
	.results {
		list-style: none;
		margin: 0;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: 12px;
		overflow: hidden;
		background: var(--paper-raised);
	}
	.results li + li {
		border-top: 1px solid var(--line);
	}
	.results a {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.8rem 1rem;
		text-decoration: none;
		color: var(--ink);
	}
	.results a:hover {
		background: var(--accent-wash);
	}
	.title {
		font-family: var(--font-display);
		font-weight: 560;
	}
	.meta {
		font-size: 0.8rem;
		color: var(--ink-faint);
	}
</style>
