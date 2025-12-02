<script lang="ts">
	import { theme } from '$lib/stores/theme';

	let currentTheme = $state('valentine');

	theme.subscribe(value => {
		currentTheme = value;
	});

	function handleToggle() {
		theme.toggle();
	}

	function getThemeIcon() {
		switch (currentTheme) {
			case 'valentine':
				// Heart icon for valentine theme
				return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
					<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
				</svg>`;
			case 'dracula':
				// Moon icon for dracula theme
				return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
				</svg>`;
			default:
				// Default sun icon
				return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
					<circle cx="12" cy="12" r="5"></circle>
					<path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"></path>
				</svg>`;
		}
	}
</script>

<button
	type="button"
	onclick={handleToggle}
	class="btn btn-ghost btn-circle"
	title="Toggle theme ({currentTheme})"
>
	{@html getThemeIcon()}
</button>