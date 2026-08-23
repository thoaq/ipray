<script lang="ts">
	import { supabaseConfigured } from '$lib/supabaseClient';

	const STORAGE_KEY = 'gebetsraum:onboarded';

	let visible = $state(typeof window !== 'undefined' && !window.localStorage.getItem(STORAGE_KEY));

	function dismiss() {
		visible = false;
		if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, '1');
	}
</script>

{#if visible}
	<div
		class="scrim"
		role="presentation"
		onclick={dismiss}
		onkeydown={(e) => e.key === 'Escape' && dismiss()}
	>
		<div
			class="card"
			role="dialog"
			aria-modal="true"
			aria-labelledby="onboarding-title"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<span class="eyebrow">Willkommen</span>
			<h2 id="onboarding-title">Dein Gebetsraum</h2>
			<p>
				Hier findest du Gebete, geordnet nach Kategorien — sofort verfügbar, auch ganz ohne Netz. Du kannst
				eigene Gebete ergänzen und Favoriten markieren.
			</p>
			{#if supabaseConfigured}
				<p>
					Alles, was du hinzufügst, gehört nur dir — niemand sonst sieht es, auch wenn andere denselben Link
					benutzen. <strong>Wichtig:</strong> Damit du auf einem zweiten Gerät darauf zugreifen kannst, sichere
					dir kurz deinen Wiederherstellungs-Code unter „Konto".
				</p>
			{/if}
			<div class="actions">
				{#if supabaseConfigured}
					<a class="secondary" href="/konto" onclick={dismiss}>Code jetzt sichern</a>
				{/if}
				<button type="button" class="primary" onclick={dismiss}>Los geht's</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.scrim {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.42);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.2rem;
		z-index: 100;
	}
	.card {
		max-width: 30rem;
		background: var(--paper-raised);
		border: 1px solid var(--line);
		border-radius: 16px;
		padding: 1.8rem 1.8rem 1.6rem;
		box-shadow: var(--shadow);
	}
	.eyebrow {
		display: inline-block;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--accent);
		margin-bottom: 0.5rem;
	}
	h2 {
		font-size: 1.5rem;
		margin-bottom: 0.9rem;
	}
	p {
		margin: 0 0 0.9rem;
		font-size: 0.95rem;
		color: var(--ink-soft);
		line-height: 1.6;
	}
	p strong {
		color: var(--ink);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem;
		margin-top: 1.2rem;
	}
	.primary,
	.secondary {
		font: inherit;
		font-size: 0.9rem;
		border-radius: 999px;
		padding: 0.6rem 1.2rem;
		cursor: pointer;
		text-decoration: none;
		text-align: center;
	}
	.primary {
		background: var(--accent);
		border: 1px solid var(--accent);
		color: var(--paper-raised);
	}
	.secondary {
		background: var(--paper);
		border: 1px solid var(--line);
		color: var(--ink);
	}
</style>
