<script lang="ts">
	import { goto } from '$app/navigation';
	import { personalPrayers } from '$lib/personalPrayers.svelte';
	import { auth } from '$lib/auth.svelte';
	import { supabaseConfigured } from '$lib/supabaseClient';
	import { classifyImageRole } from '$lib/content/imageRole';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let titel = $state('');
	let kategorie = $state('');
	let neueKategorie = $state('');
	let unterkategorie = $state('');
	let tagsInput = $state('');
	let quelle = $state('');
	let bodyText = $state('');
	let saving = $state(false);
	let error = $state('');

	let imageFile = $state<File | undefined>(undefined);
	let imagePreview = $state('');
	let imageRole = $state<'bannerBreit' | 'bannerHoch' | 'bild' | ''>('');
	let bildPosition = $state<'auto' | 'neben' | 'oben' | 'unten'>('auto');

	const kategorien = $derived(data.categories.map((c) => c.name));
	const imageUploadAvailable = $derived(supabaseConfigured && auth.ready && !!auth.userId);

	function onImageChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		imageFile = file;
		imagePreview = file ? URL.createObjectURL(file) : '';
		imageRole = '';
		bildPosition = 'auto';
		if (!file) return;
		const img = new Image();
		img.onload = () => {
			imageRole = classifyImageRole(img.naturalWidth, img.naturalHeight);
		};
		img.src = imagePreview;
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		const finalKategorie = kategorie === '__neu__' ? neueKategorie.trim() : kategorie;
		if (!titel.trim() || !finalKategorie || !bodyText.trim()) {
			error = 'Titel, Kategorie und Gebetstext werden benötigt.';
			return;
		}
		saving = true;
		try {
			const id = await personalPrayers.add({
				titel: titel.trim(),
				kategorie: finalKategorie,
				unterkategorie: unterkategorie.trim(),
				tags: tagsInput
					.split(',')
					.map((t) => t.trim())
					.filter(Boolean),
				quelle: quelle.trim(),
				bodyText: bodyText.trim(),
				imageFile,
				bildPosition
			});
			await goto(`/gebet/${id}`);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unbekannter Fehler';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Eigenes Gebet · Gebetsraum</title>
</svelte:head>

<div class="page">
	<a class="back" href="/">← Alle Kategorien</a>
	<h1>Eigenes Gebet hinzufügen</h1>

	{#if !supabaseConfigured}
		<p class="notice">
			Die persönliche Ebene ist noch nicht verbunden. Das Gebet wird trotzdem lokal auf diesem Gerät
			gespeichert, sobald ein Supabase-Projekt hinterlegt ist, wird es automatisch mitsynchronisiert.
		</p>
	{:else if !auth.ready}
		<p class="notice">Richte deinen privaten Bereich ein …</p>
	{/if}

	<form onsubmit={submit}>
		<label>
			Titel
			<input type="text" bind:value={titel} required />
		</label>

		<label>
			Kategorie
			<select bind:value={kategorie} required>
				<option value="" disabled selected>Bitte wählen…</option>
				{#each kategorien as name (name)}
					<option value={name}>{name}</option>
				{/each}
				<option value="__neu__">+ Neue Kategorie…</option>
			</select>
		</label>

		{#if kategorie === '__neu__'}
			<label>
				Name der neuen Kategorie
				<input type="text" bind:value={neueKategorie} required />
			</label>
		{/if}

		<label>
			Unterkategorie <span class="optional">(optional)</span>
			<input type="text" bind:value={unterkategorie} />
		</label>

		<label>
			Tags <span class="optional">(optional, mit Komma getrennt)</span>
			<input type="text" bind:value={tagsInput} placeholder="Trost, Familie, kurz" />
		</label>

		<label>
			Bild <span class="optional">(optional — Rolle wird automatisch aus den Bildmaßen erkannt)</span>
			<input type="file" accept="image/*" disabled={!imageUploadAvailable} onchange={onImageChange} />
		</label>

		{#if !imageUploadAvailable}
			<p class="hint">Bilder benötigen ein verbundenes Supabase-Projekt (siehe „Konto").</p>
		{:else if imagePreview}
			<div class="preview">
				<img src={imagePreview} alt="Vorschau" />
				{#if imageRole === 'bild'}
					<label class="position-label">
						Position
						<select bind:value={bildPosition}>
							<option value="auto">Automatisch (je nach Bildschirmbreite)</option>
							<option value="neben">Immer neben dem Text</option>
							<option value="oben">Immer über dem Text</option>
							<option value="unten">Immer unter dem Text</option>
						</select>
					</label>
				{:else if imageRole}
					<p class="hint">
						Erkannt als {imageRole === 'bannerBreit' ? 'breites Banner' : 'schmales Banner'} — Position
						ergibt sich automatisch aus dem Seitenverhältnis.
					</p>
				{/if}
			</div>
		{/if}

		<label>
			Gebetstext
			<textarea bind:value={bodyText} rows="8" required></textarea>
		</label>

		<label>
			Quelle <span class="optional">(optional)</span>
			<input type="text" bind:value={quelle} />
		</label>

		{#if error}
			<p class="error">{error}</p>
		{/if}

		<button type="submit" class="primary" disabled={saving}>
			{saving ? 'Speichert…' : 'Gebet speichern'}
		</button>
	</form>
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
	.hint {
		margin: -0.5rem 0 0;
		font-size: 0.82rem;
		color: var(--ink-faint);
	}
	.preview {
		display: flex;
		align-items: flex-end;
		gap: 1rem;
		flex-wrap: wrap;
		margin-top: -0.5rem;
	}
	.preview img {
		max-width: 160px;
		max-height: 160px;
		border-radius: 10px;
		border: 1px solid var(--line);
		object-fit: cover;
	}
	.position-label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.85rem;
		color: var(--ink-soft);
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.88rem;
		color: var(--ink-soft);
	}
	.optional {
		color: var(--ink-faint);
		font-weight: 400;
	}
	input,
	select,
	textarea {
		font: inherit;
		font-size: 1rem;
		color: var(--ink);
		background: var(--paper-raised);
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 0.6rem 0.75rem;
	}
	textarea {
		font-family: var(--font-display);
		resize: vertical;
	}
	input:focus,
	select:focus,
	textarea:focus {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.error {
		color: #a33b3b;
		font-size: 0.88rem;
	}
	button.primary {
		align-self: flex-start;
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
</style>
