<script lang="ts">
	import { favorites } from '$lib/favorites.svelte';
	import { personalPrayers } from '$lib/personalPrayers.svelte';
	import { categoryOverrides } from '$lib/categoryOverrides.svelte';
	import { configFor } from '$lib/content/categories';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Für ein favorisiertes, mitgeliefertes Gebet zeigt die eigene Fassung (falls vorhanden)
	// ihren aktuellen Titel/Kategorie statt der beim Fork eingefrorenen Original-Daten.
	const overrideBySlug = $derived(
		new Map(personalPrayers.items.filter((p) => p.overridesSlug).map((p) => [p.overridesSlug!, p]))
	);

	function displayKategorie(kategorie: string, kategorieSlug: string) {
		return categoryOverrides.resolve(kategorieSlug, kategorie, 'standard').name;
	}

	const items = $derived([
		...data.prayers
			.filter((p) => favorites.has(p.slug))
			.map((p) => {
				const ov = overrideBySlug.get(p.slug);
				const kategorie = ov ? ov.kategorie : p.kategorie;
				const kategorieSlug = ov ? configFor(ov.kategorie).slug : p.kategorieSlug;
				return {
					id: p.slug,
					titel: ov ? ov.titel : p.titel,
					kategorie: displayKategorie(kategorie, kategorieSlug)
				};
			}),
		...personalPrayers.items
			.filter((p) => !p.overridesSlug && favorites.has(p.id))
			.map((p) => ({ id: p.id, titel: p.titel, kategorie: displayKategorie(p.kategorie, configFor(p.kategorie).slug) }))
	]);
</script>

<svelte:head>
	<title>Favoriten · Gebetsraum</title>
</svelte:head>

<div class="page">
	<a class="back" href="/">← Alle Kategorien</a>
	<h1>Favoriten</h1>

	{#if items.length}
		<ul class="results">
			{#each items as p (p.id)}
				<li>
					<a href="/gebet/{p.id}">
						<span class="title">★ {p.titel}</span>
						<span class="meta">{p.kategorie}</span>
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="empty">Noch keine Favoriten markiert — bei einem Gebet auf „☆ Favorit" tippen.</p>
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
		color: var(--accent);
	}
	.meta {
		font-size: 0.8rem;
		color: var(--ink-faint);
	}
</style>
