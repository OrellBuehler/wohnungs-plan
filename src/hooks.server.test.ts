import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/paraglide/server', () => ({
	paraglideMiddleware: (
		request: Request,
		cb: (args: { request: Request; locale: string }) => any
	) => cb({ request, locale: 'en' })
}));

vi.mock('$lib/server/db', () => ({
	runMigrations: vi.fn()
}));

vi.mock('$lib/server/session', () => ({
	parseSessionCookie: vi.fn(() => null),
	getSessionWithUser: vi.fn()
}));

import { appHandle } from './hooks.server';

function createEvent(
	options: {
		method?: string;
		pathname?: string;
		headers?: Record<string, string>;
	} = {}
) {
	const { method = 'POST', pathname = '/api/projects', headers = {} } = options;
	const href = `http://localhost:5173${pathname}`;

	return {
		request: new Request(href, { method, headers }),
		locals: {},
		params: {},
		url: new URL(href),
		cookies: {
			get: () => undefined,
			getAll: () => [],
			set: () => {},
			delete: () => {},
			serialize: () => ''
		},
		fetch: globalThis.fetch,
		getClientAddress: () => '127.0.0.1',
		platform: {},
		isDataRequest: false,
		isSubRequest: false,
		route: { id: '' },
		setHeaders: () => {}
	} as any;
}

function run(event: any) {
	const resolve = vi.fn(async () => new Response('ok', { status: 200 }));
	return { resolve, response: appHandle({ event, resolve }) };
}

describe('CSRF protection in appHandle', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('rejects a cross-origin request without a Content-Type header', async () => {
		const { resolve, response } = run(createEvent({ headers: { origin: 'https://evil.example' } }));
		expect((await response).status).toBe(403);
		expect(resolve).not.toHaveBeenCalled();
	});

	it('rejects a cross-origin JSON request', async () => {
		const { response } = run(
			createEvent({
				headers: { origin: 'https://evil.example', 'content-type': 'application/json' }
			})
		);
		expect((await response).status).toBe(403);
	});

	it('rejects a request with neither Origin nor Sec-Fetch-Site', async () => {
		const { resolve, response } = run(createEvent());
		expect((await response).status).toBe(403);
		expect(resolve).not.toHaveBeenCalled();
	});

	it('rejects a cross-site request when only Sec-Fetch-Site is present', async () => {
		const { response } = run(createEvent({ headers: { 'sec-fetch-site': 'cross-site' } }));
		expect((await response).status).toBe(403);
	});

	it('allows a same-origin request', async () => {
		const { resolve, response } = run(
			createEvent({ headers: { origin: 'http://localhost:5173' } })
		);
		expect((await response).status).toBe(200);
		expect(resolve).toHaveBeenCalled();
	});

	it('allows a request without Origin when Sec-Fetch-Site is same-origin', async () => {
		const { response } = run(createEvent({ headers: { 'sec-fetch-site': 'same-origin' } }));
		expect((await response).status).toBe(200);
	});

	it('allows a request without Origin when Sec-Fetch-Site is none', async () => {
		const { response } = run(createEvent({ headers: { 'sec-fetch-site': 'none' } }));
		expect((await response).status).toBe(200);
	});

	it('allows safe methods without origin headers', async () => {
		const { response } = run(createEvent({ method: 'GET' }));
		expect((await response).status).toBe(200);
	});

	it('allows cross-origin requests on exempt OAuth and MCP routes', async () => {
		for (const pathname of ['/api/oauth/token', '/api/mcp', '/token']) {
			const { response } = run(createEvent({ pathname, headers: { origin: 'https://claude.ai' } }));
			expect((await response).status).toBe(200);
		}
	});
});
