import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	resolve: {
		alias: {
			'$env/dynamic/private': new URL('./src/lib/test-utils/mocks/env.ts', import.meta.url)
				.pathname
		}
	},
	test: {
		include: ['src/**/*.test.ts'],
		setupFiles: ['src/lib/test-utils/setup.ts'],
		globals: true,
		environment: 'jsdom',
		coverage: {
			provider: 'v8',
			include: ['src/lib/**'],
			exclude: ['src/lib/test-utils/**', 'src/lib/components/ui/**']
		}
	}
});
