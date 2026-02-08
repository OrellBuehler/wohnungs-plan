import { vi, beforeEach } from 'vitest';

// Polyfill crypto.randomUUID if not available
if (!globalThis.crypto?.randomUUID) {
	globalThis.crypto = {
		...globalThis.crypto,
		randomUUID: () => {
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
				const r = (Math.random() * 16) | 0;
				const v = c === 'x' ? r : (r & 0x3) | 0x8;
				return v.toString(16);
			});
		}
	} as Crypto;
}

// Mock fetch globally as a vi.fn() that can be configured per test
const fetchMock = vi.fn();
globalThis.fetch = fetchMock as any;

// Mock navigator.onLine
if (typeof navigator !== 'undefined') {
	Object.defineProperty(globalThis.navigator, 'onLine', {
		writable: true,
		configurable: true,
		value: true
	});
}

// Reset mocks between tests
beforeEach(() => {
	vi.clearAllMocks();
	// Reset navigator.onLine to default
	if (typeof navigator !== 'undefined') {
		Object.defineProperty(globalThis.navigator, 'onLine', {
			writable: true,
			configurable: true,
			value: true
		});
	}
});
