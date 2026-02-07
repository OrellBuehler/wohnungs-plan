import adapter from 'svelte-adapter-bun';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		// Disable SvelteKit's built-in CSRF to allow cross-origin OAuth token exchange.
		// Manual CSRF origin checking is applied in hooks.server.ts for non-exempt routes.
		csrf: {
			trustedOrigins: ['*']
		}
	},
	plugins: [
		SvelteKitPWA({
			strategies: 'injectManifest',
			srcDir: 'src',
			filename: 'service-worker.ts',
			registerType: 'autoUpdate',
			manifest: false, // Use existing static/manifest.json
			injectManifest: {
				globPatterns: ['**/*.{js,css,html,svg,png,woff2}']
			},
			devOptions: {
				enabled: true,
				type: 'module'
			}
		})
	]
};

export default config;
