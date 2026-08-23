<script lang="ts">
	import { favorites } from '$lib/favorites.svelte';
	import { personalPrayers } from '$lib/personalPrayers.svelte';
	import { categoryOverrides } from '$lib/categoryOverrides.svelte';
	import { configFor } from '$lib/content/categories';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const ownItems = $derived(personalPrayers.items.filter((p) => p.tags.includes(data.tag)));

	// Mitgelieferte Gebete mit eigener Fassung tauchen nur über diese auf (kein Duplikat).
	const overriddenSlugs = $derived(
		new Set(personalPrayers.items.filter((p) => p.overridesSlug).map((p) => p.overridesSlug))
	);
	const curatedItems = $derived(data.items.filter((p) => !overriddenSlugs.has(p.slug)));

	function displayKategorie(kategorie: string, kategorieSlug: string) {
		return categoryOverrides.resolve(kategorieSlug, kategorie, 'standard').name;
	}

	const allItems = $derived([
		...curatedItems.map((p) => ({
			id: p.slug,
			titel: p.titel,
			kategorie: displayKategorie(p.kategorie, p.kategorieSlug),
			imageSrc: p.image?.src
		})),
		...ownItems.map((p) => ({
			id: p.overridesSlug ?? p.id,
			titel: p.titel,
			kategorie: displayKategorie(p.kategorie, configFor(p.kategorie).slug),
			imageSrc: p.bildUrl
		}))
	]);
</script>

<svelte:head>
	<title>#{data.tag} · Gebetsraum</title>
</svelte:head>

<div class="page">
	<a class="back" href="/">← Alle Kategorien</a>
	<header class="hero">
		<span class="eyebrow">{allItems.length} {allItems.length === 1 ? 'Gebet' : 'Gebete'}</span>
		<h1>#{data.tag}</h1>
	</header>

	{#if allItems.length}
		<ul class="cards">
			{#each allItems as p (p.id)}
				<li>
					<a class="card" class:has-image={!!p.imageSrc} href="/gebet/{p.id}">
						{#if p.imageSrc}
							<span class="imgband" style="background-image:url({p.imageSrc})"></span>
						{/if}
						<span class="body">
							<span class="title">{p.titel}</span>
							<span class="meta">{p.kategorie}</span>
						</span>
						<button
							type="button"
							class="fav"
							class:active={favorites.has(p.id)}
							aria-label={favorites.has(p.id) ? 'Von Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
							onclick={(e) => {
								e.preventDefault();
								favorites.toggle(p.id);
							}}
						>
							{favorites.has(p.id) ? '★' : '☆'}
						</button>
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="notice">Keine Gebete mit diesem Tag gefunden.</p>
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

	.hero {
		margin-bottom: 1.6rem;
	}

	.eyebrow {
		display: inline-block;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--accent);
		margin-bottom: 0.5rem;
	}

	.hero h1 {
		font-size: clamp(1.8rem, 5vw, 2.3rem);
	}

	.notice {
		color: var(--ink-soft);
		font-size: 0.95rem;
	}

	.cards {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.card {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.9rem;
		border: 1px solid var(--accent-line);
		background: var(--paper-raised);
		border-radius: 12px;
		padding: 0.8rem 0.95rem;
		text-decoration: none;
		color: var(--ink);
		box-shadow: var(--shadow);
	}

	.card:hover {
		background: var(--accent-wash);
	}

	.imgband {
		width: 46px;
		height: 46px;
		border-radius: 8px;
		flex-shrink: 0;
		background-size: cover;
		background-position: center;
		border: 1px solid var(--accent-line);
	}

	.body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.title {
		font-family: var(--font-display);
		font-weight: 560;
		font-size: 1.02rem;
	}

	.meta {
		font-size: 0.8rem;
		color: var(--ink-faint);
	}

	.fav {
		font-size: 1.2rem;
		line-height: 1;
		background: none;
		border: none;
		color: var(--accent);
		cursor: pointer;
		padding: 0.3rem;
		flex-shrink: 0;
	}
</style>
