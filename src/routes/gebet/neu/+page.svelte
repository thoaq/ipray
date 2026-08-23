<script lang="ts">
	import { goto } from '$app/navigation';
	import PrayerForm from '$lib/components/PrayerForm.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const kategorien = $derived(data.categories.map((c) => c.name));
</script>

<svelte:head>
	<title>Eigenes Gebet · Gebetsraum</title>
</svelte:head>

<div class="page">
	<a class="back" href="/">← Alle Kategorien</a>
	<h1>Eigenes Gebet hinzufügen</h1>

	<PrayerForm categories={kategorien} onSaved={(id) => goto(`/gebet/${id}`)} />
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
</style>
