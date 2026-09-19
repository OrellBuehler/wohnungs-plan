import adapter from 'svelte-adapter-bun';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			precompress: true
		}),
		// Disable SvelteKit's built-in CSRF to allow cross-origin OAuth token exchange.
		// Manual CSRF origin checking is applied in hooks.server.ts for non-exempt routes.
		csrf: {
			trustedOrigins: ['*']
		},
		// The service worker is built by SvelteKitPWA (see vite.config.ts)
		serviceWorker: {
			register: false
		}
	}
};

export default config;
