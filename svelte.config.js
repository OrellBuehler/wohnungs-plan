import adapter from 'svelte-adapter-bun';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		// Allow all origins for CSRF protection (required for OAuth/MCP endpoints)
		// This is safe because:
		// 1. OAuth endpoints (/api/oauth/*) use PKCE + client credentials for auth, not cookies
		// 2. MCP endpoints (/api/mcp) use Bearer tokens for auth, not cookies
		// 3. Both are explicitly designed for cross-origin requests from unknown clients
		// 4. Cookie-based routes still have SameSite protection
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
