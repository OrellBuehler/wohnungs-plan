import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vitest/config';

// Vite plugin to handle "bun" imports in test mode.
// The bun runtime module is unavailable in vitest/node, but db.ts
// imports from it. This plugin provides a stub so vite doesn't fail
// during static import analysis.
function stubBunForTests(): Plugin {
	return {
		name: 'stub-bun-for-tests',
		enforce: 'pre',
		resolveId(id) {
			if (id === 'bun') {
				return '\0virtual:bun';
			}
		},
		load(id) {
			if (id === '\0virtual:bun') {
				return 'export class SQL {}';
			}
		}
	};
}

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		...(process.env.VITEST ? [stubBunForTests()] : [])
	],
	test: {
		include: ['src/**/*.test.ts', 'src/**/*.svelte.test.ts'],
		setupFiles: ['src/lib/test-utils/setup.ts'],
		globals: true,
		environment: 'jsdom',
		alias: {
			'$env/dynamic/private': new URL('./src/lib/test-utils/mocks/env.ts', import.meta.url)
				.pathname
		},
		server: {
			deps: {
				inline: ['drizzle-orm']
			}
		},
		coverage: {
			provider: 'v8',
			include: ['src/lib/**'],
			exclude: ['src/lib/test-utils/**', 'src/lib/components/ui/**']
		}
	}
});
