import type { Handle } from '@sveltejs/kit';
import { getSessionWithUser, parseSessionCookie } from '$lib/server/session';
import { runMigrations } from '$lib/server/db';

// Run migrations on server startup
export async function init() {
	await runMigrations();
}

/** Paths that need CORS for browser-based MCP clients (e.g. MCP Inspector) */
function needsCors(pathname: string): boolean {
	return (
		pathname.startsWith('/api/mcp') ||
		pathname.startsWith('/api/oauth/') ||
		pathname.startsWith('/.well-known/')
	);
}

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': '*',
	'Access-Control-Expose-Headers': 'Mcp-Session-Id'
} as const;

export const handle: Handle = async ({ event, resolve }) => {
	// Handle CORS preflight for MCP-related endpoints
	if (event.request.method === 'OPTIONS' && needsCors(event.url.pathname)) {
		return new Response(null, { status: 204, headers: CORS_HEADERS });
	}

	// Parse session from cookie
	const sessionId = parseSessionCookie(event.request.headers.get('cookie'));

	if (sessionId) {
		const result = await getSessionWithUser(sessionId);
		if (result) {
			event.locals.user = result.user;
			event.locals.sessionId = sessionId;
		} else {
			event.locals.user = null;
			event.locals.sessionId = null;
		}
	} else {
		event.locals.user = null;
		event.locals.sessionId = null;
	}

	const response = await resolve(event);

	// Add CORS headers to MCP-related responses
	if (needsCors(event.url.pathname)) {
		const headers = new Headers(response.headers);
		for (const [key, value] of Object.entries(CORS_HEADERS)) {
			headers.set(key, value);
		}
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers
		});
	}

	return response;
};
