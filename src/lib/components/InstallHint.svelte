<script lang="ts">
	const STORAGE_KEY = 'gebetsraum:install-hint-dismissed';

	let dismissed = $state(false);
	let deferredPrompt = $state<{ prompt: () => Promise<void> } | null>(null);
	let isIos = $state(false);
	let isStandalone = $state(false);

	$effect(() => {
		if (typeof window === 'undefined') return;
		dismissed = window.localStorage.getItem(STORAGE_KEY) === '1';
		isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !('MSStream' in window);
		isStandalone =
			window.matchMedia('(display-mode: standalone)').matches ||
			(navigator as unknown as { standalone?: boolean }).standalone === true;

		const onPrompt = (e: Event) => {
			e.preventDefault();
			deferredPrompt = e as unknown as { prompt: () => Promise<void> };
		};
		window.addEventListener('beforeinstallprompt', onPrompt);
		return () => window.removeEventListener('beforeinstallprompt', onPrompt);
	});

	const visible = $derived(!dismissed && !isStandalone && (isIos || !!deferredPrompt));

	function dismiss() {
		dismissed = true;
		window.localStorage.setItem(STORAGE_KEY, '1');
	}

	async function install() {
		if (!deferredPrompt) return;
		await deferredPrompt.prompt();
		dismiss();
	}
</script>

{#if visible}
	<div class="hint">
		{#if isIos}
			<p>Zum Home-Bildschirm hinzufügen: Teilen-Symbol <span aria-hidden="true">⬆︎</span> antippen, dann „Zum Home-Bildschirm".</p>
		{:else}
			<p>Als App installieren, um Gebetsraum vom Startbildschirm zu öffnen.</p>
		{/if}
		<div class="actions">
			{#if !isIos}
				<button type="button" class="install" onclick={install}>Installieren</button>
			{/if}
			<button type="button" class="dismiss" onclick={dismiss} aria-label="Hinweis schließen">✕</button>
		</div>
	</div>
{/if}

<style>
	.hint {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		background: var(--accent-wash);
		border-bottom: 1px solid var(--accent-line);
		padding: 0.6rem clamp(1rem, 4vw, 2rem);
		font-size: 0.85rem;
		color: var(--ink);
	}
	.hint p {
		margin: 0;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.install {
		font: inherit;
		font-size: 0.82rem;
		background: var(--accent);
		border: 1px solid var(--accent);
		color: var(--paper-raised);
		border-radius: 999px;
		padding: 0.35rem 0.85rem;
		cursor: pointer;
	}
	.dismiss {
		font: inherit;
		background: none;
		border: none;
		color: var(--ink-faint);
		cursor: pointer;
		padding: 0.2rem 0.3rem;
	}
	.dismiss:hover {
		color: var(--ink);
	}
</style>
