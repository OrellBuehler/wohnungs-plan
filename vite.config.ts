import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vitest/config';

function stubBunForTests() {
	return {
		name: 'stub-bun-for-tests',
		enforce: 'pre' as const,
		resolveId(id: string) {
			if (id === 'bun') {
				return '\0virtual:bun';
			}
		},
		load(id: string) {
			if (id === '\0virtual:bun') {
				return 'export class SQL {}';
			}
		}
	};
}

export default defineConfig({
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			strategies: 'injectManifest',
			// SvelteKit builds with a relative base; the worker must be registered
			// from the site root so it can control every route
			buildBase: '/',
			scope: '/',
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
		}),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			strategy: ['cookie', 'preferredLanguage', 'baseLocale']
		}),
		...(process.env.VITEST ? [stubBunForTests()] : [])
	] as any,
	test: {
		include: ['src/**/*.test.ts', 'src/**/*.svelte.test.ts'],
		setupFiles: ['src/lib/test-utils/setup.ts'],
		globals: true,
		environment: 'jsdom',
		alias: {
			'$env/dynamic/private': new URL('./src/lib/test-utils/mocks/env.ts', import.meta.url).pathname
		},
		server: {
			deps: {
				inline: ['drizzle-orm', 'svelte-sonner', 'runed']
			}
		},
		coverage: {
			provider: 'v8',
			include: ['src/lib/**'],
			exclude: ['src/lib/test-utils/**', 'src/lib/components/ui/**']
		}
	}
});
