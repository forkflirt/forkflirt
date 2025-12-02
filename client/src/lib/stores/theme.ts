import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const themes = ['valentine', 'dracula'];

function createThemeStore() {
	const defaultTheme = 'valentine';
	const initialTheme = browser ? localStorage.getItem('theme') ?? defaultTheme : defaultTheme;

	const { subscribe, set, update } = writable(initialTheme);

	return {
		subscribe,
		set: (theme: string) => {
			if (browser && themes.includes(theme)) {
				localStorage.setItem('theme', theme);
				document.documentElement.setAttribute('data-theme', theme);
			}
			set(theme);
		},
		toggle: () => {
			update(current => {
				const currentIndex = themes.indexOf(current);
				const nextIndex = (currentIndex + 1) % themes.length;
				const nextTheme = themes[nextIndex];

				if (browser) {
					localStorage.setItem('theme', nextTheme);
					document.documentElement.setAttribute('data-theme', nextTheme);
				}

				return nextTheme;
			});
		},
		themes
	};
}

export const theme = createThemeStore();