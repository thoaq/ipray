<script lang="ts">
	import { liveQuery } from 'dexie';
	import { auth } from '$lib/auth.svelte';
	import { supabaseConfigured } from '$lib/supabaseClient';
	import { personalPrayers } from '$lib/personalPrayers.svelte';
	import { favorites } from '$lib/favorites.svelte';
	import { categoryOverrides } from '$lib/categoryOverrides.svelte';
	import { db } from '$lib/db';

	// Nur für die Anzeige unten: Favoriten-Rohzeilen inkl. dirty-Flag, da favorites.svelte nur
	// die aktiven IDs ohne Sync-Status nach außen gibt.
	let unsyncedFavoriteCount = $state(0);
	$effect(() => {
		const sub = liveQuery(() => db.favorites.where('dirty').equals(1).count()).subscribe({
			next: (n) => (unsyncedFavoriteCount = n)
		});
		return () => sub.unsubscribe();
	});

	let revealed = $state(false);
	let copyState = $state<'idle' | 'copied'>('idle');
	let inviteState = $state<'idle' | 'copied'>('idle');
	let restoreInput = $state('');
	let restoreState = $state<'idle' | 'working' | 'error' | 'done'>('idle');
	let restoreError = $state('');
	let restorePending = $state(false);

	const localPrayerCount = $derived(personalPrayers.items.length);
	const localUnsyncedPrayerCount = $derived(personalPrayers.items.filter((p) => p.dirty === 1).length);
	const localFavoriteCount = $derived(favorites.activeIds.size);
	const hasLocalContent = $derived(localPrayerCount > 0 || localFavoriteCount > 0);

	// Diagnose-Anzeige: Änderungen, die lokal auf diesem Gerät liegen, aber noch nicht
	// erfolgreich zu Supabase hochgeladen wurden — sonst ist das von außen unsichtbar
	// (siehe Sync-Fehlersuche: fehlende Daten auf einem anderen Gerät können daran liegen,
	// dass sie hier nie ankamen, nicht daran, dass das andere Gerät sie falsch abholt).
	const unsyncedCategoryOverrideCount = $derived(categoryOverrides.items.filter((c) => c.dirty === 1).length);
	const totalUnsynced = $derived(localUnsyncedPrayerCount + unsyncedFavoriteCount + unsyncedCategoryOverrideCount);

	const restoreWarning = $derived.by(() => {
		const parts: string[] = [];
		if (localPrayerCount) parts.push(`${localPrayerCount} eigene ${localPrayerCount === 1 ? 'Gebet' : 'Gebete'}`);
		if (localFavoriteCount) parts.push(`${localFavoriteCount} ${localFavoriteCount === 1 ? 'Favorit' : 'Favoriten'}`);
		const summary = `Auf diesem Gerät ${parts.length > 1 ? 'sind' : localFavoriteCount ? 'sind' : 'ist'} aktuell ${parts.join(' und ')} gespeichert.`;
		const consequence =
			'Nach dem Verbinden zeigt dieses Gerät stattdessen den Stand des anderen Kontos — diese Inhalte sind hier danach nicht mehr zu sehen.';
		const detail = localUnsyncedPrayerCount
			? `${localUnsyncedPrayerCount} davon ${localUnsyncedPrayerCount === 1 ? 'ist' : 'sind'} noch nicht gesichert und ${localUnsyncedPrayerCount === 1 ? 'geht' : 'gehen'} dabei unwiederbringlich verloren.`
			: 'Bereits gesicherte Inhalte bleiben unter dem bisherigen Konto in der Cloud erhalten.';
		return `${summary} ${consequence} ${detail}`;
	});

	async function copyCode() {
		if (!auth.recoveryCode) return;
		await navigator.clipboard.writeText(auth.recoveryCode);
		copyState = 'copied';
		setTimeout(() => (copyState = 'idle'), 1800);
	}

	async function inviteOthers() {
		const url = window.location.origin;
		const text = 'Ich lade dich zu meinem Gebetsraum ein — deine eigene, private Gebete-Sammlung:';
		if (navigator.share) {
			try {
				await navigator.share({ title: 'Gebetsraum', text, url });
			} catch {
				/* Nutzer hat den Teilen-Dialog abgebrochen */
			}
			return;
		}
		await navigator.clipboard.writeText(url);
		inviteState = 'copied';
		setTimeout(() => (inviteState = 'idle'), 1800);
	}

	function attemptRestore() {
		if (!restoreInput.trim()) return;
		restoreError = '';
		if (hasLocalContent) {
			restorePending = true;
		} else {
			void restore();
		}
	}

	function cancelRestore() {
		restorePending = false;
	}

	async function restore() {
		restorePending = false;
		restoreState = 'working';
		const result = await auth.restoreOnThisDevice(restoreInput);
		if (result.ok) {
			restoreState = 'done';
		} else {
			restoreState = 'error';
			restoreError = result.error ?? 'Unbekannter Fehler';
		}
	}
</script>

<svelte:head>
	<title>Konto · Gebetsraum</title>
</svelte:head>

<div class="page">
	<a class="back" href="/">← Alle Kategorien</a>
	<h1>Konto</h1>

	{#if !supabaseConfigured}
		<p class="notice">
			Die persönliche Ebene ist noch nicht verbunden — sobald ein Supabase-Projekt hinterlegt ist, kannst du
			hier deinen Wiederherstellungs-Code für weitere Geräte finden.
		</p>
	{:else if !auth.ready}
		<p class="notice">Richte deinen privaten Bereich ein …</p>
	{:else}
		{#if auth.accountId}
			<p class="account-id">
				Konto-Kennung: <code>…{auth.accountId.slice(-8)}</code>
				<span class="hint">
					— stimmt diese Kennung auf allen deinen Geräten überein, nutzen sie dasselbe Konto. Anders als der
					Wiederherstellungs-Code unten ändert sie sich nicht und erlaubt für sich allein keinen Zugriff.
				</span>
			</p>
		{/if}

		{#if totalUnsynced > 0}
			<p class="unsynced-warning">
				⚠ {totalUnsynced} {totalUnsynced === 1 ? 'Änderung ist' : 'Änderungen sind'} auf diesem Gerät noch nicht
				mit der Cloud synchronisiert — solange das so bleibt, sieht kein anderes Gerät diese
				{totalUnsynced === 1 ? 'Änderung' : 'Änderungen'}. Meist reicht es, kurz online und die App geöffnet zu
				lassen.
			</p>
		{/if}

		<section>
			<h2>Familie &amp; Freunde einladen</h2>
			<p class="lede">
				Teile einfach den App-Link. Jede Person, die ihn öffnet, bekommt automatisch ihren eigenen, privaten
				Bereich — ihr seht gegenseitig nicht die Gebete der anderen.
			</p>
			<button type="button" class="primary" onclick={inviteOthers}>
				{inviteState === 'copied' ? 'Link kopiert' : '⤴ Link teilen'}
			</button>
		</section>

		<section class="warn">
			<h2>Dieses Konto sichern</h2>
			<p class="lede">
				Mit diesem Code öffnest du <strong>deine eigenen</strong> Gebete und Favoriten auf einem weiteren Gerät.
				Behandle ihn wie ein Passwort und teile ihn mit niemandem — das ist etwas anderes als der Einladungslink
				oben: Wer diesen Code hat, sieht deine privaten Gebete, nicht nur seine eigenen.
			</p>
			{#if !revealed}
				<button type="button" class="primary" onclick={() => (revealed = true)}>Code anzeigen</button>
			{:else}
				<code class="code">{auth.recoveryCode}</code>
				<button type="button" class="secondary" onclick={copyCode}>
					{copyState === 'copied' ? 'Kopiert' : 'Code kopieren'}
				</button>
			{/if}
		</section>

		<section>
			<h2>Anderes eigenes Gerät verbinden</h2>
			<p class="lede">Code von einem bereits eingerichteten Gerät hier eintragen, um dieselben Gebete zu laden.</p>
			<div class="restore-row">
				<input type="text" bind:value={restoreInput} placeholder="Wiederherstellungs-Code einfügen" />
				<button type="button" class="primary" onclick={attemptRestore} disabled={restoreState === 'working'}>
					Verbinden
				</button>
			</div>

			{#if restorePending}
				<div class="confirm">
					<p>{restoreWarning}</p>
					<div class="confirm-actions">
						<button type="button" class="danger" onclick={restore}>Trotzdem verbinden</button>
						<button type="button" class="secondary" onclick={cancelRestore}>Abbrechen</button>
					</div>
				</div>
			{:else if restoreState === 'error'}
				<p class="error">{restoreError}</p>
			{:else if restoreState === 'done'}
				<p class="success">Verbunden — deine Gebete werden gerade geladen.</p>
			{/if}
		</section>
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
		margin-bottom: 1.6rem;
	}
	section {
		border: 1px solid var(--line);
		background: var(--paper-raised);
		border-radius: 12px;
		padding: 1.3rem 1.4rem;
		margin-bottom: 1.2rem;
	}
	section.warn {
		border-color: #d9b38c;
		background: color-mix(in srgb, #a33b3b 6%, var(--paper-raised));
	}
	.unsynced-warning {
		font-size: 0.85rem;
		color: var(--ink);
		background: color-mix(in srgb, #a33b3b 8%, var(--paper-raised));
		border: 1px solid #d9b38c;
		border-radius: 10px;
		padding: 0.7rem 0.9rem;
		margin: 0 0 1.4rem;
	}
	h2 {
		font-size: 1.1rem;
		margin-bottom: 0.5rem;
	}
	.lede {
		color: var(--ink-soft);
		font-size: 0.92rem;
		margin: 0 0 1rem;
	}
	.notice {
		color: var(--ink-soft);
		font-size: 0.95rem;
	}
	.account-id {
		font-size: 0.85rem;
		color: var(--ink-soft);
		margin: 0 0 1.4rem;
	}
	.account-id code {
		font-family: var(--font-mono);
		background: var(--paper-raised);
		border: 1px solid var(--line);
		border-radius: 6px;
		padding: 0.1rem 0.4rem;
	}
	.account-id .hint {
		color: var(--ink-faint);
	}
	.code {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		background: var(--paper);
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 0.7rem 0.9rem;
		word-break: break-all;
		margin-bottom: 0.8rem;
	}
	button {
		font: inherit;
		font-size: 0.9rem;
		border-radius: 999px;
		padding: 0.55rem 1.1rem;
		cursor: pointer;
	}
	button.primary {
		background: var(--accent);
		border: 1px solid var(--accent);
		color: var(--paper-raised);
	}
	button.secondary {
		background: var(--paper);
		border: 1px solid var(--line);
		color: var(--ink);
	}
	button.danger {
		background: #a33b3b;
		border: 1px solid #a33b3b;
		color: #fff;
	}
	button:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.confirm {
		margin-top: 0.9rem;
		border: 1px solid #d9b38c;
		background: color-mix(in srgb, #a33b3b 6%, var(--paper-raised));
		border-radius: 10px;
		padding: 0.9rem 1rem;
	}
	.confirm p {
		margin: 0 0 0.9rem;
		font-size: 0.88rem;
		color: var(--ink-soft);
		line-height: 1.55;
	}
	.confirm-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}
	.restore-row {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.restore-row input {
		flex: 1;
		min-width: 220px;
		font: inherit;
		padding: 0.55rem 0.8rem;
		border-radius: 8px;
		border: 1px solid var(--line);
		background: var(--paper);
		color: var(--ink);
	}
	.error {
		color: #a33b3b;
		font-size: 0.88rem;
		margin: 0.7rem 0 0;
	}
	.success {
		color: var(--accent);
		font-size: 0.88rem;
		margin: 0.7rem 0 0;
	}
</style>
