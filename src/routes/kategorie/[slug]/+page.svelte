<script lang="ts">
	import { schemeFor, schemeCssVars } from '$lib/content/schemes';
	import { configFor } from '$lib/content/categories';
	import { styleFromVars } from '$lib/styles/cssVars';
	import { theme } from '$lib/theme.svelte';
	import { favorites } from '$lib/favorites.svelte';
	import { personalPrayers } from '$lib/personalPrayers.svelte';
	import { categoryOverrides } from '$lib/categoryOverrides.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const ownItems = $derived(personalPrayers.items.filter((p) => configFor(p.kategorie).slug === data.slug));

	// Mitgelieferte Gebete, für die eine eigene Fassung existiert, tauchen nur noch über
	// diese Fassung auf — sonst stünde dasselbe Gebet doppelt in der Liste.
	const overriddenSlugs = $derived(
		new Set(personalPrayers.items.filter((p) => p.overridesSlug).map((p) => p.overridesSlug))
	);
	const curatedItems = $derived(data.items.filter((p) => !overriddenSlugs.has(p.slug)));

	const categoryInfo = $derived.by(() => {
		const base = data.category ?? (() => {
			const first = ownItems[0];
			if (!first) return null;
			const cfg = configFor(first.kategorie);
			return { name: first.kategorie, slug: cfg.slug, schema: cfg.schema, count: ownItems.length };
		})();
		if (!base) return null;
		return { ...base, ...categoryOverrides.resolve(base.slug, base.name, base.schema) };
	});

	const allItems = $derived([
		...curatedItems.map((p) => ({
			id: p.slug,
			titel: p.titel,
			unterkategorie: p.unterkategorie,
			tags: p.tags,
			imageSrc: p.image?.src
		})),
		...ownItems.map((p) => ({
			id: p.overridesSlug ?? p.id,
			titel: p.titel,
			unterkategorie: p.unterkategorie,
			tags: p.tags,
			imageSrc: p.bildUrl
		}))
	]);

	const scheme = $derived(schemeFor(categoryInfo?.schema));
	const varsStyle = $derived(styleFromVars(schemeCssVars(scheme, theme.isDark)));
</script>

<svelte:head>
	<title>{categoryInfo ? `${categoryInfo.name} · Gebetsraum` : 'Gebetsraum'}</title>
</svelte:head>

<div class="page" style={varsStyle}>
	<a class="back" href="/">← Alle Kategorien</a>

	{#if categoryInfo}
		<header class="hero">
			<span class="eyebrow">{allItems.length} {allItems.length === 1 ? 'Gebet' : 'Gebete'}</span>
			<div class="hero-row">
				<h1>{categoryInfo.name}</h1>
				<a class="edit-link" href="/kategorie/{data.slug}/bearbeiten">✏️ Bearbeiten</a>
			</div>
		</header>

		<ul class="cards">
			{#each allItems as p (p.id)}
				<li>
					<a class="card" class:has-image={!!p.imageSrc} href="/gebet/{p.id}">
						{#if p.imageSrc}
							<span class="imgband" style="background-image:url({p.imageSrc})"></span>
						{/if}
						<span class="body">
							<span class="title">{p.titel}</span>
							<span class="meta">
								{p.unterkategorie ?? categoryInfo.name}{#if p.tags.length}
									· {p.tags.join(', ')}{/if}
							</span>
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
	{:else if personalPrayers.loaded}
		<p class="notice">Diese Kategorie wurde nicht gefunden.</p>
	{/if}
</div>

<style>
	.page {
		max-width: var(--content-max);
		margin: 0 auto;
		padding: clamp(2rem, 5vw, 3.5rem) clamp(1.1rem, 4vw, 1.5rem) 4rem;
		background: var(--accent-wash);
		min-height: 100%;
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

	.hero-row {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.7rem;
	}

	.hero h1 {
		font-size: clamp(1.8rem, 5vw, 2.3rem);
	}

	.edit-link {
		font-size: 0.82rem;
		color: var(--ink-faint);
		text-decoration: none;
	}
	.edit-link:hover {
		color: var(--ink);
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
		background: var(--accent-soft);
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

	.notice {
		color: var(--ink-soft);
		font-size: 0.95rem;
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
