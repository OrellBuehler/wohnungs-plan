import { describe, it, expect, vi } from 'vitest';

import {
	parseSessionCookie,
	createSessionCookie,
	clearSessionCookie,
	generateSessionId
} from './session';

// Mock the env config used by createSessionCookie/clearSessionCookie
vi.mock('./env', () => ({
	config: {
		infomaniak: {
			redirectUri: 'http://localhost:5173/api/auth/callback'
		}
	}
}));

describe('parseSessionCookie', () => {
	it('extracts session ID from cookie header', () => {
		const result = parseSessionCookie('session=abc-123; other=value');
		expect(result).toBe('abc-123');
	});

	it('returns null for missing cookie', () => {
		expect(parseSessionCookie('other=value')).toBeNull();
	});

	it('returns null for null input', () => {
		expect(parseSessionCookie(null)).toBeNull();
	});

	it('handles session as only cookie', () => {
		expect(parseSessionCookie('session=my-session-id')).toBe('my-session-id');
	});
});

describe('createSessionCookie', () => {
	it('contains session ID', () => {
		const cookie = createSessionCookie('sess-123');
		expect(cookie).toContain('session=sess-123');
	});

	it('is HttpOnly', () => {
		const cookie = createSessionCookie('sess-123');
		expect(cookie).toContain('HttpOnly');
	});

	it('has Path=/', () => {
		const cookie = createSessionCookie('sess-123');
		expect(cookie).toContain('Path=/');
	});

	it('has SameSite=Lax by default', () => {
		const cookie = createSessionCookie('sess-123');
		expect(cookie).toContain('SameSite=Lax');
	});

	it('does not include Secure flag for http redirect URI', () => {
		const cookie = createSessionCookie('sess-123');
		// The mock sets redirectUri to http://localhost, so Secure should NOT be present
		expect(cookie).not.toContain('Secure');
	});

	it('includes Secure flag when explicitly set', () => {
		const cookie = createSessionCookie('sess-123', { secure: true });
		expect(cookie).toContain('Secure');
	});

	it('has Max-Age set', () => {
		const cookie = createSessionCookie('sess-123');
		expect(cookie).toMatch(/Max-Age=\d+/);
	});

	it('respects sameSite option', () => {
		const cookie = createSessionCookie('sess-123', { sameSite: 'strict' });
		expect(cookie).toContain('SameSite=Strict');
	});
});

describe('clearSessionCookie', () => {
	it('has Max-Age=0', () => {
		const cookie = clearSessionCookie();
		expect(cookie).toContain('Max-Age=0');
	});

	it('has empty session value', () => {
		const cookie = clearSessionCookie();
		expect(cookie).toContain('session=');
		// Make sure it's empty (session= followed by ; or end)
		expect(cookie).toMatch(/session=;|session=$/);
	});

	it('is HttpOnly', () => {
		const cookie = clearSessionCookie();
		expect(cookie).toContain('HttpOnly');
	});
});

describe('generateSessionId', () => {
	it('returns a UUID format', () => {
		const id = generateSessionId();
		expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
	});

	it('generates unique IDs', () => {
		const a = generateSessionId();
		const b = generateSessionId();
		expect(a).not.toBe(b);
	});
});
