<script lang="ts">
	import { marked } from 'marked';
	import { goto } from '$app/navigation';
	import { schemeFor, schemeCssVars } from '$lib/content/schemes';
	import { configFor } from '$lib/content/categories';
	import { styleFromVars } from '$lib/styles/cssVars';
	import { theme } from '$lib/theme.svelte';
	import { favorites } from '$lib/favorites.svelte';
	import { personalPrayers } from '$lib/personalPrayers.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Kuratierte Gebete kommen aus data.prayer (server-geladen); eigene Gebete liegen
	// nur clientseitig in Dexie und werden hier reaktiv nachgeschlagen (siehe +page.ts).
	const personal = $derived(data.prayer ? undefined : personalPrayers.byId(data.slug));

	const view = $derived.by(() => {
		if (data.prayer) {
			return {
				id: data.prayer.slug,
				titel: data.prayer.titel,
				kategorie: data.prayer.kategorie,
				kategorieSlug: data.prayer.kategorieSlug,
				unterkategorie: data.prayer.unterkategorie,
				tags: data.prayer.tags,
				quelle: data.prayer.quelle,
				schema: data.prayer.schema,
				bodyHtml: data.prayer.bodyHtml,
				image: data.prayer.image,
				own: false
			};
		}
		if (personal) {
			const cfg = configFor(personal.kategorie);
			return {
				id: personal.id,
				titel: personal.titel,
				kategorie: personal.kategorie,
				kategorieSlug: cfg.slug,
				unterkategorie: personal.unterkategorie,
				tags: personal.tags,
				quelle: personal.quelle,
				schema: cfg.schema,
				bodyHtml: marked.parse(personal.bodyText) as string,
				image:
					personal.bildUrl && personal.bildRolle && personal.bildBreite && personal.bildHoehe
						? {
								src: personal.bildUrl,
								rolle: personal.bildRolle,
								position: personal.bildPosition ?? 'auto',
								breite: personal.bildBreite,
								hoehe: personal.bildHoehe
							}
						: undefined,
				own: true
			};
		}
		return null;
	});

	const scheme = $derived(schemeFor(view?.schema));
	const varsStyle = $derived(styleFromVars(schemeCssVars(scheme, theme.isDark)));
	const img = $derived(view?.image);
	const roleClass = $derived(img ? `role-${img.rolle}` : 'role-none');
	const posClass = $derived(img ? `pos-${img.position}` : '');

	let shareState = $state<'idle' | 'copied'>('idle');
	let deleting = $state(false);

	async function share() {
		if (!view) return;
		const url = window.location.href;
		if (navigator.share) {
			try {
				await navigator.share({ title: view.titel, url });
			} catch {
				/* Nutzer hat den Teilen-Dialog abgebrochen */
			}
			return;
		}
		await navigator.clipboard.writeText(url);
		shareState = 'copied';
		setTimeout(() => (shareState = 'idle'), 1800);
	}

	async function removeOwn() {
		if (!view || !confirm(`„${view.titel}" wirklich löschen?`)) return;
		deleting = true;
		await personalPrayers.remove(view.id);
		await goto('/');
	}
</script>

<svelte:head>
	<title>{view ? `${view.titel} · Gebetsraum` : 'Gebetsraum'}</title>
</svelte:head>

{#if view}
	<div class="page" style={varsStyle}>
		<a class="back" href="/kategorie/{view.kategorieSlug}">← {view.kategorie}</a>

		<article class="detail {roleClass} {posClass}">
			{#if img}
				<div class="figure" style="aspect-ratio:{img.breite}/{img.hoehe}">
					<img src={img.src} alt="" width={img.breite} height={img.hoehe} />
				</div>
			{/if}
			<div class="text">
				<span class="eyebrow"
					>{view.kategorie}{#if view.unterkategorie} · {view.unterkategorie}{/if}{#if view.own} · Eigenes Gebet{/if}</span
				>
				<h1>{view.titel}</h1>

				<div class="body">{@html view.bodyHtml}</div>

				<footer>
					<div class="tags">
						{#each view.tags as tag (tag)}
							<span class="tag">{tag}</span>
						{/each}
					</div>
					{#if view.quelle}
						<p class="source">Quelle: {view.quelle}</p>
					{/if}
					<div class="actions">
						<button
							type="button"
							class="action fav"
							class:active={favorites.has(view.id)}
							onclick={() => favorites.toggle(view.id)}
						>
							{favorites.has(view.id) ? '★ Favorit' : '☆ Favorit'}
						</button>
						<button type="button" class="action" onclick={share}>
							{shareState === 'copied' ? 'Link kopiert' : '⤴ Teilen'}
						</button>
						<button type="button" class="action" onclick={() => window.print()}>⎙ Drucken / PDF</button>
						{#if view.own}
							<button type="button" class="action danger" onclick={removeOwn} disabled={deleting}>
								🗑 Löschen
							</button>
						{/if}
					</div>
				</footer>
			</div>
		</article>
	</div>
{:else if !personalPrayers.loaded}
	<div class="page"><p class="notice">Lädt …</p></div>
{:else}
	<div class="page">
		<p class="notice">Dieses Gebet wurde nicht gefunden.</p>
		<a class="back" href="/">← Zur Übersicht</a>
	</div>
{/if}

<style>
	.page {
		container: gebet / inline-size;
		max-width: var(--content-max-wide);
		margin: 0 auto;
		padding: clamp(2rem, 5vw, 3.5rem) clamp(1.1rem, 4vw, 2rem) 5rem;
	}

	.back {
		display: inline-block;
		font-size: 0.85rem;
		color: var(--ink-faint);
		text-decoration: none;
		margin-bottom: 1.5rem;
	}
	.back:hover {
		color: var(--ink);
	}

	.detail {
		display: flex;
		flex-direction: column;
		gap: 1.6rem;
		align-items: stretch;
	}

	.figure {
		width: 100%;
		border-radius: 16px;
		overflow: hidden;
		border: 1px solid var(--accent-line);
		box-shadow: var(--shadow);
		max-height: 60vh;
	}
	.figure img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	/* Banner hoch: ohne genug Platz als kurz beschnittene Kopfzeile */
	.role-bannerHoch .figure {
		aspect-ratio: 3 / 1 !important;
	}

	/* Bild „unten": Figure nach dem Text */
	.role-bild.pos-unten .figure {
		order: 2;
	}
	.role-bild.pos-unten .text {
		order: 1;
	}

	.text {
		flex: 1;
		min-width: 0;
		max-width: 70ch;
	}

	.eyebrow {
		display: inline-block;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--accent);
		margin-bottom: 0.6rem;
	}

	.text h1 {
		font-size: clamp(1.9rem, 5vw, 2.6rem);
		margin-bottom: 1.3rem;
	}

	.body {
		font-family: var(--font-display);
		font-size: 1.18rem;
		line-height: 1.85;
		color: var(--ink);
	}
	.body :global(p) {
		margin: 0 0 1.1em;
	}
	.body :global(p:last-child) {
		margin-bottom: 0;
	}

	footer {
		margin-top: 2.2rem;
		padding-top: 1.3rem;
		border-top: 1px solid var(--line);
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 0.7rem;
	}
	.tag {
		font-size: 0.76rem;
		background: var(--accent-soft);
		color: var(--ink);
		border: 1px solid var(--accent-line);
		border-radius: 999px;
		padding: 0.2rem 0.65rem;
	}

	.source {
		font-size: 0.82rem;
		color: var(--ink-faint);
		margin: 0 0 1.1rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}
	.action {
		font: inherit;
		font-size: 0.86rem;
		background: var(--paper-raised);
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 0.45rem 0.9rem;
		color: var(--ink-soft);
		cursor: pointer;
	}
	.action:hover {
		color: var(--ink);
		border-color: var(--accent-line);
	}
	.action.fav.active {
		color: var(--accent);
		border-color: var(--accent-line);
		background: var(--accent-soft);
	}
	.action.danger:hover {
		color: #a33b3b;
		border-color: #a33b3b;
	}

	.notice {
		color: var(--ink-soft);
		font-size: 0.95rem;
	}

	/* Banner hoch: ab genug Breite als schmale Spalte neben dem Text */
	@container gebet (min-width: 800px) {
		.role-bannerHoch.detail {
			flex-direction: row;
			align-items: stretch;
		}
		.role-bannerHoch .figure {
			width: 150px;
			flex-shrink: 0;
			aspect-ratio: auto !important;
			max-height: none;
		}
	}

	/* Bild: ab genug Breite automatisch neben dem Text (nur im Default „auto") */
	@container gebet (min-width: 900px) {
		.role-bild.pos-auto.detail {
			flex-direction: row;
			align-items: flex-start;
		}
		.role-bild.pos-auto .figure {
			width: 260px;
			flex-shrink: 0;
			max-height: none;
		}
	}

	/* Bild „neben": erzwungen, unabhängig von der Breite */
	.role-bild.pos-neben.detail {
		flex-direction: row;
		align-items: flex-start;
	}
	.role-bild.pos-neben .figure {
		width: 260px;
		flex-shrink: 0;
		max-height: none;
	}

	@media print {
		.back,
		.actions {
			display: none;
		}
	}
</style>
