<script lang="ts">
	import { marked } from 'marked';
	import { goto } from '$app/navigation';
	import { schemeFor, schemeCssVars } from '$lib/content/schemes';
	import { configFor } from '$lib/content/categories';
	import { styleFromVars } from '$lib/styles/cssVars';
	import { theme } from '$lib/theme.svelte';
	import { favorites } from '$lib/favorites.svelte';
	import { personalPrayers } from '$lib/personalPrayers.svelte';
	import { categoryOverrides } from '$lib/categoryOverrides.svelte';
	import type { LocalPrayer } from '$lib/db';
	import type { PrayerImage } from '$lib/content/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Kuratierte Gebete kommen aus data.prayer (server-geladen). Eigene Gebete und eigene
	// Fassungen mitgelieferter Gebete (Fork beim Bearbeiten) liegen nur clientseitig in
	// Dexie und werden hier reaktiv nachgeschlagen (siehe +page.ts).
	const override = $derived(data.prayer ? personalPrayers.byOverriddenSlug(data.slug) : undefined);
	const personal = $derived(data.prayer ? undefined : personalPrayers.byId(data.slug));

	function imageFrom(p: LocalPrayer): PrayerImage | undefined {
		if (!p.bildUrl || !p.bildRolle || !p.bildBreite || !p.bildHoehe) return undefined;
		return {
			src: p.bildUrl,
			rolle: p.bildRolle,
			position: p.bildPosition ?? 'auto',
			breite: p.bildBreite,
			hoehe: p.bildHoehe
		};
	}

	const rawView = $derived.by(() => {
		if (data.prayer && !override) {
			return {
				id: data.prayer.slug,
				recordId: undefined as string | undefined,
				titel: data.prayer.titel,
				kategorie: data.prayer.kategorie,
				kategorieSlug: data.prayer.kategorieSlug,
				unterkategorie: data.prayer.unterkategorie,
				tags: data.prayer.tags,
				quelle: data.prayer.quelle,
				schema: data.prayer.schema,
				bodyHtml: data.prayer.bodyHtml,
				image: data.prayer.image,
				own: false,
				isOverride: false
			};
		}
		if (override) {
			const cfg = configFor(override.kategorie);
			return {
				id: data.slug,
				recordId: override.id,
				titel: override.titel,
				kategorie: override.kategorie,
				kategorieSlug: cfg.slug,
				unterkategorie: override.unterkategorie,
				tags: override.tags,
				quelle: override.quelle,
				schema: cfg.schema,
				bodyHtml: marked.parse(override.bodyText) as string,
				image: imageFrom(override),
				own: true,
				isOverride: true
			};
		}
		if (personal) {
			const cfg = configFor(personal.kategorie);
			return {
				id: personal.id,
				recordId: personal.id,
				titel: personal.titel,
				kategorie: personal.kategorie,
				kategorieSlug: cfg.slug,
				unterkategorie: personal.unterkategorie,
				tags: personal.tags,
				quelle: personal.quelle,
				schema: cfg.schema,
				bodyHtml: marked.parse(personal.bodyText) as string,
				image: imageFrom(personal),
				own: true,
				isOverride: false
			};
		}
		return null;
	});

	// Persönliche Kategorie-Anpassung (Name/Farbschema) auf das Gebet anwenden.
	const view = $derived.by(() => {
		if (!rawView) return null;
		const resolved = categoryOverrides.resolve(rawView.kategorieSlug, rawView.kategorie, rawView.schema);
		return { ...rawView, kategorie: resolved.name, schema: resolved.schema };
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
		if (!view || !view.recordId) return;
		const confirmMsg = view.isOverride
			? `Eigene Fassung von „${view.titel}" verwerfen und zum Original zurückkehren?`
			: `„${view.titel}" wirklich löschen?`;
		if (!confirm(confirmMsg)) return;
		deleting = true;
		await personalPrayers.remove(view.recordId);
		if (view.isOverride) {
			// Sobald die eigene Fassung als gelöscht markiert ist, zeigt view reaktiv
			// wieder das mitgelieferte Original — keine Navigation nötig.
			deleting = false;
		} else {
			await goto('/');
		}
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
				<h1>{view.titel}</h1>
				<span class="eyebrow"
					>{#if view.unterkategorie}{view.unterkategorie}{' · '}{/if}{view.kategorie}</span
				>

				<div class="body">{@html view.bodyHtml}</div>

				<footer>
					<div class="tags">
						{#each view.tags as tag (tag)}
							<a class="tag" href="/tag/{encodeURIComponent(tag)}">{tag}</a>
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
						<a class="action" href="/gebet/{data.slug}/bearbeiten">✏️ Bearbeiten</a>
						{#if view.own}
							<button type="button" class="action danger" onclick={removeOwn} disabled={deleting}>
								{view.isOverride ? '↺ Eigene Fassung verwerfen' : '🗑 Löschen'}
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
		background: var(--accent-wash);
		min-height: 100%;
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
		margin-bottom: 1.3rem;
	}

	.text h1 {
		font-size: clamp(1.9rem, 5vw, 2.6rem);
		margin-bottom: 0.4rem;
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
		text-decoration: none;
	}
	.tag:hover {
		border-color: var(--accent);
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
		text-decoration: none;
		display: inline-block;
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

	/* Banner hoch, automatisch: ab genug Breite als schmale Spalte neben dem Text,
	   darunter als kurz beschnittene Kopfzeile (schont das Bildmotiv bei Fotos). */
	@container gebet (min-width: 800px) {
		.role-bannerHoch.pos-auto.detail {
			flex-direction: row;
			align-items: stretch;
		}
		.role-bannerHoch.pos-auto .figure {
			width: 150px;
			flex-shrink: 0;
			aspect-ratio: auto !important;
			max-height: none;
		}
	}

	/* Banner hoch „neben": erzwungen, unabhängig von der Breite — die Spalte wird auf
	   schmalen Bildschirmen schmaler statt auf eine beschnittene Kopfzeile umzuschalten.
	   Bei einem Foto mit erkennbarem Motiv meist ungünstig, bei einem abstrakten
	   Mosaik-Banner unproblematisch — daher eine bewusste Wahl, kein neuer Standard. */
	.role-bannerHoch.pos-neben.detail {
		flex-direction: row;
		align-items: stretch;
	}
	.role-bannerHoch.pos-neben .figure {
		width: clamp(56px, 26cqi, 150px);
		flex-shrink: 0;
		aspect-ratio: auto !important;
		max-height: none;
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
		.page {
			background: none;
		}
		.back,
		.actions,
		.figure {
			display: none;
		}
	}
</style>
