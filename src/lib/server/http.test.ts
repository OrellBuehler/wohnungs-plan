import { describe, it, expect } from 'vitest';
import { isInsideDir, isSecureRequest } from './http';

function makeHeaders(entries: Record<string, string>): Headers {
	return new Headers(entries);
}

describe('isSecureRequest', () => {
	it('returns true when x-forwarded-proto is https', () => {
		const url = new URL('http://localhost:5173');
		const headers = makeHeaders({ 'x-forwarded-proto': 'https' });
		expect(isSecureRequest(url, headers)).toBe(true);
	});

	it('returns false when x-forwarded-proto is http', () => {
		const url = new URL('https://localhost:5173');
		const headers = makeHeaders({ 'x-forwarded-proto': 'http' });
		expect(isSecureRequest(url, headers)).toBe(false);
	});

	it('handles comma-separated x-forwarded-proto (first wins)', () => {
		const url = new URL('http://localhost:5173');
		const headers = makeHeaders({ 'x-forwarded-proto': 'https, http' });
		expect(isSecureRequest(url, headers)).toBe(true);
	});

	it('handles comma-separated x-forwarded-proto with http first', () => {
		const url = new URL('https://localhost:5173');
		const headers = makeHeaders({ 'x-forwarded-proto': 'http, https' });
		expect(isSecureRequest(url, headers)).toBe(false);
	});

	it('returns true when forwarded header has proto=https', () => {
		const url = new URL('http://localhost:5173');
		const headers = makeHeaders({ forwarded: 'for=1.2.3.4;proto=https;by=proxy' });
		expect(isSecureRequest(url, headers)).toBe(true);
	});

	it('returns false when forwarded header has proto=http', () => {
		const url = new URL('https://localhost:5173');
		const headers = makeHeaders({ forwarded: 'proto=http' });
		expect(isSecureRequest(url, headers)).toBe(false);
	});

	it('falls back to URL protocol when no proxy headers', () => {
		const httpsUrl = new URL('https://example.com');
		const httpUrl = new URL('http://example.com');
		const headers = makeHeaders({});
		expect(isSecureRequest(httpsUrl, headers)).toBe(true);
		expect(isSecureRequest(httpUrl, headers)).toBe(false);
	});

	it('x-forwarded-proto takes precedence over forwarded header', () => {
		const url = new URL('http://localhost:5173');
		const headers = makeHeaders({
			'x-forwarded-proto': 'https',
			forwarded: 'proto=http'
		});
		expect(isSecureRequest(url, headers)).toBe(true);
	});
});

describe('isInsideDir', () => {
	it('accepts a path inside the directory', () => {
		expect(isInsideDir('/uploads/item-images/a/b/c.png', '/uploads')).toBe(true);
	});

	it('rejects a traversal outside the directory', () => {
		expect(isInsideDir('/uploads/item-images/../../etc/passwd', '/uploads')).toBe(false);
	});

	it('rejects the directory itself', () => {
		expect(isInsideDir('/uploads', '/uploads')).toBe(false);
	});

	it('rejects a sibling directory with the same prefix', () => {
		expect(isInsideDir('/uploads-other/file.png', '/uploads')).toBe(false);
	});

	it('resolves relative directories', () => {
		expect(isInsideDir('./uploads/a.png', './uploads')).toBe(true);
	});
});
