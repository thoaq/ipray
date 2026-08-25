<script lang="ts">
	import { untrack } from 'svelte';
	import { personalPrayers } from '$lib/personalPrayers.svelte';
	import { auth } from '$lib/auth.svelte';
	import { supabaseConfigured } from '$lib/supabaseClient';
	import { classifyImageRole } from '$lib/content/imageRole';
	import { categoryOverrides } from '$lib/categoryOverrides.svelte';
	import { configFor } from '$lib/content/categories';
	import { listUserImages, type ExistingImageEntry } from '$lib/imageUpload';
	import { schemeBanners, type SchemeBanner } from '$lib/content/schemeBanners';
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
	let bannerImage = $state<{ url: string; rolle: BildRolle; breite: number; hoehe: number } | undefined>(undefined);

	let galleryOpen = $state(false);
	let galleryLoading = $state(false);
	let galleryError = $state('');
	let galleryImages = $state<ExistingImageEntry[]>([]);

	// Die eigene Kategorie mit aufnehmen, falls sie (noch) nicht in der kuratierten
	// Liste steht — sonst würde das Bearbeiten sie sonst stillschweigend zurücksetzen.
	// Gespeichert wird weiterhin der ursprüngliche Name (Wert), angezeigt wird die
	// persönliche Umbenennung, falls vorhanden (Label) — wie überall sonst in der App.
	const kategorien = $derived.by(() => {
		const names = new Set(categories);
		if (initial?.kategorie) names.add(initial.kategorie);
		return [...names]
			.map((name) => ({ name, displayName: categoryOverrides.resolve(configFor(name).slug, name, 'standard').name }))
			.sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'));
	});

	const imageUploadAvailable = $derived(supabaseConfigured && auth.ready && !!auth.userId);

	function onImageChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		imageFile = file;
		selectedExistingPath = undefined;
		bannerImage = undefined;
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
		bannerImage = undefined;
		imagePreview = '';
		imageRole = '';
		removeImage = true;
		galleryOpen = false;
	}

	async function toggleGallery() {
		galleryOpen = !galleryOpen;
		if (galleryOpen && galleryImages.length === 0 && !galleryLoading && imageUploadAvailable && auth.userId) {
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
		bannerImage = undefined;
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

	/** Mitgeliefertes Mosaik-Banner wählen — rein statisches Asset, Rolle/Maße stehen schon fest,
	 *  kein Upload/Kopieren nötig und unabhängig von einem verbundenen Supabase-Konto. */
	function selectBanner(banner: SchemeBanner, orientation: 'breit' | 'hoch') {
		const variant = banner[orientation];
		imageFile = undefined;
		selectedExistingPath = undefined;
		bannerImage = { url: variant.url, rolle: variant.rolle, breite: variant.breite, hoehe: variant.hoehe };
		removeImage = false;
		imagePreview = variant.url;
		imageRole = variant.rolle;
		bildPosition = 'auto';
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
				!bannerImage &&
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
				bannerImage,
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
			{#each kategorien as cat (cat.name)}
				<option value={cat.name}>{cat.displayName}</option>
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
		Untertitel <span class="optional">(optional)</span>
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

	<button type="button" class="link-button" onclick={toggleGallery}>
		{galleryOpen ? 'Galerie schließen' : 'Bild aus Galerie wählen…'}
	</button>

	{#if galleryOpen}
		<div class="gallery">
			<div class="gallery-section">
				<span class="gallery-label">Farbschema-Banner</span>
				<p class="hint">Horizontal</p>
				<div class="scheme-row">
					{#each schemeBanners as banner (banner.key)}
						<button
							type="button"
							class="scheme-item scheme-item-breit"
							class:selected={bannerImage?.url === banner.breit.url}
							title={banner.name}
							aria-label={banner.name}
							onclick={() => selectBanner(banner, 'breit')}
						>
							<img src={banner.breit.url} alt="" loading="lazy" />
						</button>
					{/each}
				</div>
				<p class="hint">Vertikal</p>
				<div class="scheme-row">
					{#each schemeBanners as banner (banner.key)}
						<button
							type="button"
							class="scheme-item scheme-item-hoch"
							class:selected={bannerImage?.url === banner.hoch.url}
							title={banner.name}
							aria-label={banner.name}
							onclick={() => selectBanner(banner, 'hoch')}
						>
							<img src={banner.hoch.url} alt="" loading="lazy" />
						</button>
					{/each}
				</div>
			</div>

			<div class="gallery-section">
				<span class="gallery-label">Eigene Bilder</span>
				{#if !imageUploadAvailable}
					<p class="hint">Eigene Bilder benötigen ein verbundenes Supabase-Projekt (siehe „Konto").</p>
				{:else if galleryLoading}
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
		</div>
	{/if}

	{#if imagePreview}
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
				{:else if imageRole === 'bannerHoch'}
					<label class="position-label">
						Position
						<select bind:value={bildPosition}>
							<option value="auto">Automatisch (ab ausreichender Breite neben dem Text, sonst oben)</option>
							<option value="neben">Immer neben dem Text (wird auf schmalen Bildschirmen schmaler statt oben zu stehen)</option>
						</select>
					</label>
				{:else if imageRole}
					<p class="hint">Erkannt als breites Banner — Position ergibt sich automatisch aus dem Seitenverhältnis.</p>
				{/if}
				<button type="button" class="link-button" onclick={clearImage}>Bild entfernen</button>
			</div>
		</div>
	{:else if !imageUploadAvailable}
		<p class="hint">
			Foto-Upload und eigene Bilder benötigen ein verbundenes Supabase-Projekt (siehe „Konto") —
			Farbschema-Banner sind unabhängig davon verfügbar.
		</p>
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
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}
	.gallery-section {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.gallery-label {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--ink-soft);
	}
	.scheme-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}
	.scheme-item {
		padding: 0;
		border: 2px solid transparent;
		border-radius: 6px;
		background: none;
		cursor: pointer;
		overflow: hidden;
		flex: none;
	}
	.scheme-item img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.scheme-item-breit {
		width: 116px;
		height: 29px;
	}
	.scheme-item-hoch {
		width: 40px;
		height: 100px;
	}
	.scheme-item.selected {
		border-color: var(--accent);
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
