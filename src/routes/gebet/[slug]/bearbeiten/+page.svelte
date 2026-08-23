<script lang="ts">
	import { goto } from '$app/navigation';
	import PrayerForm from '$lib/components/PrayerForm.svelte';
	import { personalPrayers } from '$lib/personalPrayers.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const kategorien = $derived(data.categories.map((c) => c.name));

	// Eigene Fassung des Slugs (falls schon eine existiert) oder ein rein persönliches
	// Gebet mit diesem Slug als eigene ID — beides wird direkt bearbeitet.
	const override = $derived(personalPrayers.byOverriddenSlug(data.slug));
	const ownPersonal = $derived(personalPrayers.byId(data.slug));
	const editingRecord = $derived(override ?? ownPersonal);

	// Noch keine eigene Fassung, aber ein mitgeliefertes Original vorhanden: Formular wird
	// mit dessen Inhalt vorausgefüllt, Speichern legt eine neue eigene Fassung an (Fork).
	const forkSeed = $derived.by(() => {
		if (editingRecord || !data.curated) return undefined;
		const c = data.curated;
		return {
			titel: c.titel,
			kategorie: c.kategorie,
			unterkategorie: c.unterkategorie,
			tags: c.tags,
			quelle: c.quelle,
			bodyText: c.bodyText,
			bildUrl: c.image?.src,
			bildRolle: c.image?.rolle,
			bildBreite: c.image?.breite,
			bildHoehe: c.image?.hoehe,
			bildPosition: c.image?.position
		};
	});
</script>

<svelte:head>
	<title>Gebet bearbeiten · Gebetsraum</title>
</svelte:head>

<div class="page">
	<a class="back" href="/gebet/{data.slug}">← Zurück</a>
	<h1>Gebet bearbeiten</h1>

	{#if editingRecord}
		<PrayerForm
			categories={kategorien}
			initial={editingRecord}
			editId={editingRecord.id}
			onSaved={(id) => goto(`/gebet/${id}`)}
		/>
	{:else if data.curated}
		<PrayerForm
			categories={kategorien}
			initial={forkSeed}
			overridesSlug={data.slug}
			onSaved={(id) => goto(`/gebet/${id}`)}
		/>
	{:else if !personalPrayers.loaded}
		<p class="notice">Lädt …</p>
	{:else}
		<p class="notice">Dieses Gebet wurde nicht gefunden.</p>
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
		margin-bottom: 1rem;
	}
	.notice {
		color: var(--ink-soft);
		font-size: 0.95rem;
	}
</style>
