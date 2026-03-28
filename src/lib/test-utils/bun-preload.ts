import { mock } from 'bun:test';

// svelte-sonner depends on 'runed' which bun cannot resolve from within node_modules.
// Preloading this stub prevents the resolution failure during bun test runs.
mock.module('svelte-sonner', () => ({
	toast: {
		error: () => {},
		success: () => {},
		info: () => {},
		warning: () => {}
	}
}));
