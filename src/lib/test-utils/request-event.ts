/**
 * Factory for creating mock SvelteKit RequestEvent objects for API route tests.
 */
export function createMockRequestEvent(
	options: {
		method?: string;
		headers?: Record<string, string>;
		body?: unknown;
		locals?: Record<string, unknown>;
		params?: Record<string, string>;
		url?: string;
	} = {}
) {
	const {
		method = 'GET',
		headers = {},
		body,
		locals = {},
		params = {},
		url = 'http://localhost:5173/api/test'
	} = options;

	const headerObj = new Headers(headers);

	const request = new Request(url, {
		method,
		headers: headerObj,
		...(body ? { body: JSON.stringify(body) } : {})
	});

	return {
		request,
		locals,
		params,
		url: new URL(url),
		route: { id: '' },
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
		isSubRequest: false
	} as any;
}
