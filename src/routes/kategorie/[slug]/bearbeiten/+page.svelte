<script lang="ts">
	import { goto } from '$app/navigation';
	import { schemes } from '$lib/content/schemes';
	import { theme } from '$lib/theme.svelte';
	import { categoryOverrides } from '$lib/categoryOverrides.svelte';
	import { personalPrayers } from '$lib/personalPrayers.svelte';
	import { configFor } from '$lib/content/categories';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const baseInfo = $derived.by(() => {
		if (data.base) return data.base;
		const first = personalPrayers.items.find((p) => configFor(p.kategorie).slug === data.slug);
		if (!first) return null;
		const cfg = configFor(first.kategorie);
		return { name: first.kategorie, slug: cfg.slug, schema: cfg.schema };
	});

	const hasOverride = $derived(!!categoryOverrides.get(data.slug));

	let name = $state('');
	let schemaKey = $state('');
	let initialized = $state(false);
	let saving = $state(false);
	let error = $state('');

	$effect(() => {
		if (initialized || !baseInfo) return;
		const resolved = categoryOverrides.resolve(baseInfo.slug, baseInfo.name, baseInfo.schema);
		name = resolved.name;
		schemaKey = resolved.schema;
		initialized = true;
	});

	function swatchColor(key: string) {
		const s = schemes[key] ?? schemes.standard;
		return theme.isDark ? s.dark.accent : s.light.accent;
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		if (!name.trim()) {
			error = 'Bitte einen Namen angeben.';
			return;
		}
		saving = true;
		await categoryOverrides.set(data.slug, { displayName: name.trim(), schema: schemaKey });
		await goto(`/kategorie/${data.slug}`);
	}

	async function reset() {
		await categoryOverrides.remove(data.slug);
		await goto(`/kategorie/${data.slug}`);
	}
</script>

<svelte:head>
	<title>Kategorie bearbeiten · Gebetsraum</title>
</svelte:head>

<div class="page">
	<a class="back" href="/kategorie/{data.slug}">← Zurück</a>
	<h1>Kategorie bearbeiten</h1>

	{#if baseInfo}
		<p class="notice">
			Deine Änderungen gelten nur für dich — die Zuordnung der Gebete zu dieser Kategorie bleibt unverändert,
			nur Name und Akzentfarbe werden für dich angepasst.
		</p>

		<form onsubmit={submit}>
			<label>
				Name
				<input type="text" bind:value={name} required />
			</label>

			<fieldset>
				<legend>Farbschema</legend>
				<div class="swatches">
					{#each Object.values(schemes) as scheme (scheme.key)}
						<button
							type="button"
							class="swatch"
							class:active={schemaKey === scheme.key}
							style="background:{swatchColor(scheme.key)}"
							title={scheme.name}
							aria-label={scheme.name}
							onclick={() => (schemaKey = scheme.key)}
						></button>
					{/each}
				</div>
			</fieldset>

			{#if error}
				<p class="error">{error}</p>
			{/if}

			<div class="actions">
				<button type="submit" class="primary" disabled={saving}>
					{saving ? 'Speichert…' : 'Speichern'}
				</button>
				{#if hasOverride}
					<button type="button" class="secondary" onclick={reset}>Auf Standard zurücksetzen</button>
				{/if}
			</div>
		</form>
	{:else if !personalPrayers.loaded}
		<p class="notice">Lädt …</p>
	{:else}
		<p class="notice">Diese Kategorie wurde nicht gefunden.</p>
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
		font-size: 0.92rem;
		margin-bottom: 1.3rem;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 1.3rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.88rem;
		color: var(--ink-soft);
	}
	input {
		font: inherit;
		font-size: 1rem;
		color: var(--ink);
		background: var(--paper-raised);
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 0.6rem 0.75rem;
	}
	input:focus {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	fieldset {
		border: none;
		padding: 0;
		margin: 0;
	}
	legend {
		font-size: 0.88rem;
		color: var(--ink-soft);
		margin-bottom: 0.6rem;
		padding: 0;
	}
	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem;
	}
	.swatch {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: 2px solid transparent;
		cursor: pointer;
		padding: 0;
		box-shadow: 0 0 0 1px var(--line);
	}
	.swatch.active {
		border-color: var(--paper-raised);
		box-shadow:
			0 0 0 1px var(--line),
			0 0 0 3px var(--ink);
	}
	.error {
		color: #a33b3b;
		font-size: 0.88rem;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem;
	}
	button.primary {
		font: inherit;
		font-size: 0.95rem;
		background: var(--accent);
		border: 1px solid var(--accent);
		color: var(--paper-raised);
		border-radius: 999px;
		padding: 0.65rem 1.4rem;
		cursor: pointer;
	}
	button.primary:disabled {
		opacity: 0.6;
		cursor: default;
	}
	button.secondary {
		font: inherit;
		font-size: 0.9rem;
		background: var(--paper-raised);
		border: 1px solid var(--line);
		color: var(--ink-soft);
		border-radius: 999px;
		padding: 0.6rem 1.2rem;
		cursor: pointer;
	}
	button.secondary:hover {
		color: var(--ink);
	}
</style>
