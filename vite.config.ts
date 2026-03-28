import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
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
