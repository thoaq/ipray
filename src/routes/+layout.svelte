<script lang="ts">
	import '$lib/styles/tokens.css';
	import favicon from '$lib/assets/favicon.svg';
	import { theme } from '$lib/theme.svelte';
	import { auth } from '$lib/auth.svelte';
	import { requestSync } from '$lib/sync';
	import Onboarding from '$lib/components/Onboarding.svelte';
	import InstallHint from '$lib/components/InstallHint.svelte';

	let { children } = $props();

	$effect(() => {
		if (theme.override) document.documentElement.dataset.theme = theme.override;
		else delete document.documentElement.dataset.theme;
	});

	$effect(() => {
		if (!auth.ready || !auth.userId) return;
		requestSync();
	});

	$effect(() => {
		const interval = setInterval(requestSync, 60_000);
		window.addEventListener('online', requestSync);
		return () => {
			clearInterval(interval);
			window.removeEventListener('online', requestSync);
		};
	});

	const toggleLabel = $derived(
		theme.override === 'light' ? '☀️ Hell' : theme.override === 'dark' ? '🌙 Dunkel' : '🌓 System'
	);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="shell">
	<header class="topbar">
		<a class="brand" href="/">Gebetsraum</a>
		<nav class="topnav">
			<a href="/suche">Suche</a>
			<a href="/favoriten">Favoriten</a>
			<a href="/gebet/neu">+ Eigenes Gebet</a>
			<a href="/konto">Konto</a>
			<button type="button" class="theme-toggle" onclick={() => theme.cycle()}>{toggleLabel}</button>
		</nav>
	</header>
	<InstallHint />
	<main>
		{@render children()}
	</main>
</div>

<Onboarding />

<style>
	.shell {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}

	.topbar {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.9rem clamp(1rem, 4vw, 2rem);
		background: color-mix(in srgb, var(--paper-raised) 88%, transparent);
		backdrop-filter: blur(8px);
		border-bottom: 1px solid var(--line);
	}

	.brand {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 1.15rem;
		color: var(--ink);
		text-decoration: none;
	}

	.topnav {
		display: flex;
		align-items: center;
		gap: 1.1rem;
		font-size: 0.92rem;
	}

	.topnav a {
		text-decoration: none;
		color: var(--ink-soft);
	}

	.topnav a:hover {
		color: var(--ink);
	}

	.theme-toggle {
		font: inherit;
		font-size: 0.85rem;
		background: var(--paper);
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 0.35rem 0.75rem;
		color: var(--ink-soft);
		cursor: pointer;
	}

	.theme-toggle:hover {
		color: var(--ink);
		border-color: var(--accent-line);
	}

	main {
		flex: 1;
	}
</style>
