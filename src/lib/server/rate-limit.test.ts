import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkRateLimit } from './rate-limit';

describe('checkRateLimit', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('allows first request', () => {
		expect(checkRateLimit('test-first-1')).toBe(true);
	});

	it('allows up to max attempts', () => {
		const key = 'test-max-1';
		for (let i = 0; i < 5; i++) {
			expect(checkRateLimit(key, 5)).toBe(true);
		}
	});

	it('blocks after max attempts', () => {
		const key = 'test-block-1';
		for (let i = 0; i < 3; i++) {
			checkRateLimit(key, 3);
		}
		expect(checkRateLimit(key, 3)).toBe(false);
	});

	it('resets after window expires', () => {
		const key = 'test-reset-1';
		const windowMs = 1000;

		// Exhaust the limit
		for (let i = 0; i < 3; i++) {
			checkRateLimit(key, 3, windowMs);
		}
		expect(checkRateLimit(key, 3, windowMs)).toBe(false);

		// Advance time past the window
		vi.advanceTimersByTime(windowMs + 1);

		// Should be allowed again
		expect(checkRateLimit(key, 3, windowMs)).toBe(true);
	});

	it('uses separate buckets for different keys', () => {
		const keyA = 'test-separate-a';
		const keyB = 'test-separate-b';

		// Exhaust keyA
		for (let i = 0; i < 2; i++) {
			checkRateLimit(keyA, 2);
		}
		expect(checkRateLimit(keyA, 2)).toBe(false);

		// keyB should still be allowed
		expect(checkRateLimit(keyB, 2)).toBe(true);
	});

	it('cleans stale buckets when size exceeds 100', () => {
		const windowMs = 100;
		// Create 101 unique keys to trigger cleanup
		for (let i = 0; i < 101; i++) {
			checkRateLimit(`stale-${i}`, 20, windowMs);
		}

		// Advance time to expire all buckets
		vi.advanceTimersByTime(windowMs + 1);

		// Creating a new key should trigger cleanup and succeed
		expect(checkRateLimit('stale-new', 20, windowMs)).toBe(true);
	});
});
