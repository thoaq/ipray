<script lang="ts">
	import { untrack } from 'svelte';
	import { personalPrayers } from '$lib/personalPrayers.svelte';
	import { auth } from '$lib/auth.svelte';
	import { supabaseConfigured } from '$lib/supabaseClient';
	import { classifyImageRole } from '$lib/content/imageRole';
	import { listUserImages, type ExistingImageEntry } from '$lib/imageUpload';
	import type { LocalPrayer } from '$lib/db';
	import type { BildPosition, BildRolle } from '$lib/content/types';

	let {
		categories,
		initial,
		editId,
		overridesSlug,
		onSaved
	}: {
		categories: string[];
		/** Befüllt das Formular — bei einer eigenen Fassung das existierende Gebet,
		 *  beim Anlegen einer Fassung eines mitgelieferten Gebets dessen Inhalt. */
		initial?: Partial<LocalPrayer>;
		/** Gesetzt, wenn gespeichert ein bestehendes eigenes Gebet aktualisiert statt ein neues anzulegen. */
		editId?: string;
		/** Gesetzt, wenn das neu angelegte Gebet eine eigene Fassung dieses mitgelieferten Slugs wird. */
		overridesSlug?: string;
		onSaved: (id: string) => void;
	} = $props();

	// Nur der Ausgangswert beim Öffnen des Formulars zählt — spätere Änderungen an
	// initial (z.B. durch einen Sync im Hintergrund) sollen laufende Eingaben nicht
	// überschreiben, darum bewusst einmalig mit untrack() gelesen.
	const start = untrack(() => initial);
	const isEdit = !!start;

	let titel = $state(start?.titel ?? '');
	let kategorie = $state(start?.kategorie ?? '');
	let neueKategorie = $state('');
	let unterkategorie = $state(start?.unterkategorie ?? '');
	let tagsInput = $state(start?.tags?.join(', ') ?? '');
	let quelle = $state(start?.quelle ?? '');
	let bodyText = $state(start?.bodyText ?? '');
	let saving = $state(false);
	let error = $state('');

	let imageFile = $state<File | undefined>(undefined);
	let imagePreview = $state(start?.bildUrl ?? '');
	let imageRole = $state<BildRolle | ''>(start?.bildRolle ?? '');
	let bildPosition = $state<BildPosition>(start?.bildPosition ?? 'auto');
	let removeImage = $state(false);
	let selectedExistingPath = $state<string | undefined>(undefined);

	let galleryOpen = $state(false);
	let galleryLoading = $state(false);
	let galleryError = $state('');
	let galleryImages = $state<ExistingImageEntry[]>([]);

	// Die eigene Kategorie mit aufnehmen, falls sie (noch) nicht in der kuratierten
	// Liste steht — sonst würde das Bearbeiten sie sonst stillschweigend zurücksetzen.
	const kategorien = $derived.by(() => {
		const names = new Set(categories);
		if (initial?.kategorie) names.add(initial.kategorie);
		return [...names].sort((a, b) => a.localeCompare(b, 'de'));
	});

	const imageUploadAvailable = $derived(supabaseConfigured && auth.ready && !!auth.userId);

	function onImageChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		imageFile = file;
		selectedExistingPath = undefined;
		removeImage = false;
		if (!file) {
			imagePreview = start?.bildUrl ?? '';
			imageRole = start?.bildRolle ?? '';
			return;
		}
		imagePreview = URL.createObjectURL(file);
		imageRole = '';
		bildPosition = 'auto';
		const img = new Image();
		img.onload = () => {
			imageRole = classifyImageRole(img.naturalWidth, img.naturalHeight);
		};
		img.src = imagePreview;
	}

	function clearImage() {
		imageFile = undefined;
		selectedExistingPath = undefined;
		imagePreview = '';
		imageRole = '';
		removeImage = true;
		galleryOpen = false;
	}

	async function toggleGallery() {
		galleryOpen = !galleryOpen;
		if (galleryOpen && galleryImages.length === 0 && !galleryLoading && auth.userId) {
			galleryLoading = true;
			galleryError = '';
			try {
				galleryImages = await listUserImages(auth.userId);
			} catch (err) {
				galleryError = err instanceof Error ? err.message : 'Bilder konnten nicht geladen werden.';
			} finally {
				galleryLoading = false;
			}
		}
	}

	function selectExistingImage(entry: ExistingImageEntry) {
		imageFile = undefined;
		selectedExistingPath = entry.path;
		removeImage = false;
		imagePreview = entry.url;
		imageRole = '';
		bildPosition = 'auto';
		const img = new Image();
		img.onload = () => {
			imageRole = classifyImageRole(img.naturalWidth, img.naturalHeight);
		};
		img.src = entry.url;
		galleryOpen = false;
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
			// Bild unverändert übernehmen (z.B. vom mitgelieferten Original beim Anlegen einer
			// eigenen Fassung), wenn weder eine neue Datei gewählt noch "Entfernen" geklickt wurde.
			const existingImage =
				!imageFile &&
				!selectedExistingPath &&
				!removeImage &&
				start?.bildUrl &&
				start?.bildRolle &&
				start?.bildBreite &&
				start?.bildHoehe
					? { url: start.bildUrl, rolle: start.bildRolle, breite: start.bildBreite, hoehe: start.bildHoehe }
					: undefined;

			const payload = {
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
				existingImagePath: selectedExistingPath,
				bildPosition,
				removeImage,
				existingImage,
				overridesSlug
			};
			if (editId) {
				await personalPrayers.update(editId, payload);
				onSaved(editId);
			} else {
				const id = await personalPrayers.add(payload);
				onSaved(overridesSlug ?? id);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unbekannter Fehler';
		} finally {
			saving = false;
		}
	}
</script>

{#if !supabaseConfigured}
	<p class="notice">
		Die persönliche Ebene ist noch nicht verbunden. Das Gebet wird trotzdem lokal auf diesem Gerät gespeichert,
		sobald ein Supabase-Projekt hinterlegt ist, wird es automatisch mitsynchronisiert.
	</p>
{:else if !auth.ready}
	<p class="notice">Richte deinen privaten Bereich ein …</p>
{:else if overridesSlug && !editId}
	<p class="notice">
		Deine Änderungen werden als eigene Fassung gespeichert — nur du siehst sie, das mitgelieferte Original
		bleibt für alle anderen unverändert.
	</p>
{/if}

<form onsubmit={submit}>
	<label>
		Titel
		<input type="text" bind:value={titel} required />
	</label>

	<label>
		Kategorie
		<select bind:value={kategorie} required>
			<option value="" disabled selected={!start}>Bitte wählen…</option>
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

	{#if imageUploadAvailable}
		<button type="button" class="link-button" onclick={toggleGallery}>
			{galleryOpen ? 'Galerie schließen' : 'Vorhandenes Bild wählen…'}
		</button>
	{/if}

	{#if galleryOpen}
		<div class="gallery">
			{#if galleryLoading}
				<p class="hint">Lädt…</p>
			{:else if galleryError}
				<p class="error">{galleryError}</p>
			{:else if galleryImages.length === 0}
				<p class="hint">Noch keine eigenen Bilder hochgeladen.</p>
			{:else}
				<div class="gallery-grid">
					{#each galleryImages as entry (entry.path)}
						<button
							type="button"
							class="gallery-item"
							class:selected={selectedExistingPath === entry.path}
							onclick={() => selectExistingImage(entry)}
						>
							<img src={entry.url} alt="" loading="lazy" />
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	{#if !imageUploadAvailable}
		<p class="hint">Bilder benötigen ein verbundenes Supabase-Projekt (siehe „Konto").</p>
	{:else if imagePreview}
		<div class="preview">
			<img src={imagePreview} alt="Vorschau" />
			<div class="preview-controls">
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
						Erkannt als {imageRole === 'bannerBreit' ? 'breites Banner' : 'schmales Banner'} — Position ergibt
						sich automatisch aus dem Seitenverhältnis.
					</p>
				{/if}
				<button type="button" class="link-button" onclick={clearImage}>Bild entfernen</button>
			</div>
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
		{#if saving}
			Speichert…
		{:else if isEdit}
			Änderungen speichern
		{:else}
			Gebet speichern
		{/if}
	</button>
</form>

<style>
	.notice {
		color: var(--ink-soft);
		font-size: 0.92rem;
		margin-bottom: 1.3rem;
	}
	.hint {
		margin: 0;
		font-size: 0.82rem;
		color: var(--ink-faint);
	}
	.gallery {
		margin-top: -0.6rem;
	}
	.gallery-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
		gap: 0.5rem;
		max-height: 260px;
		overflow-y: auto;
		padding: 0.25rem;
	}
	.gallery-item {
		padding: 0;
		border: 2px solid transparent;
		border-radius: 8px;
		background: none;
		cursor: pointer;
		overflow: hidden;
		aspect-ratio: 1;
	}
	.gallery-item img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.gallery-item.selected {
		border-color: var(--accent);
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
	.preview-controls {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: flex-start;
	}
	.position-label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.85rem;
		color: var(--ink-soft);
	}
	.link-button {
		font: inherit;
		font-size: 0.82rem;
		background: none;
		border: none;
		color: var(--accent);
		cursor: pointer;
		padding: 0;
		text-decoration: underline;
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
