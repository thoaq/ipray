// Reaktive Erkennung des aktiven Hell-/Dunkel-Modus (System-Präferenz + optionales manuelles Override).

const STORAGE_KEY = 'gebetsraum:theme';

type ThemeOverride = 'light' | 'dark' | null;

function readSystemPrefersDark(): boolean {
	if (typeof window === 'undefined') return false;
	return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readOverride(): ThemeOverride {
	if (typeof window === 'undefined') return null;
	const stored = window.localStorage.getItem(STORAGE_KEY);
	return stored === 'light' || stored === 'dark' ? stored : null;
}

class ThemeState {
	systemPrefersDark = $state(readSystemPrefersDark());
	override: ThemeOverride = $state(readOverride());

	isDark = $derived(this.override ? this.override === 'dark' : this.systemPrefersDark);

	constructor() {
		if (typeof window !== 'undefined') {
			const mq = window.matchMedia('(prefers-color-scheme: dark)');
			mq.addEventListener('change', (e) => {
				this.systemPrefersDark = e.matches;
			});
		}
	}

	setOverride(value: ThemeOverride) {
		this.override = value;
		if (typeof window === 'undefined') return;
		if (value) window.localStorage.setItem(STORAGE_KEY, value);
		else window.localStorage.removeItem(STORAGE_KEY);
	}

	cycle() {
		// System -> Hell -> Dunkel -> System
		if (this.override === null) this.setOverride('light');
		else if (this.override === 'light') this.setOverride('dark');
		else this.setOverride(null);
	}
}

export const theme = new ThemeState();
