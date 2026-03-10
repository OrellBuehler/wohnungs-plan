import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { getSessionWithUser, parseSessionCookie } from '$lib/server/session';
import { runMigrations } from '$lib/server/db';

// Run migrations on server startup
export async function init() {
	await runMigrations();
}

/** Paths that need CORS and are exempt from CSRF origin checks */
function isCrossOriginEndpoint(pathname: string): boolean {
	return (
		pathname.startsWith('/api/mcp') ||
		pathname.startsWith('/api/oauth/') ||
		pathname.startsWith('/.well-known/') ||
		pathname === '/token'
	);
}

const FORM_CONTENT_TYPES = [
	'application/x-www-form-urlencoded',
	'multipart/form-data',
	'text/plain'
];

/**
 * Manual CSRF origin check for non-exempt routes.
 * SvelteKit's built-in CSRF is disabled (trustedOrigins: ['*']) to allow
 * cross-origin OAuth token exchange. This re-applies origin checking for
 * cookie-authenticated form submissions (e.g. /settings/mcp, /oauth/consent).
 */
function isOriginMismatch(request: Request, url: URL): boolean {
	const method = request.method;
	if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH' && method !== 'DELETE') {
		return false;
	}

	const contentType = request.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
	if (!FORM_CONTENT_TYPES.includes(contentType)) {
		return false;
	}

	const origin = request.headers.get('origin');
	if (!origin) return false;

	return origin !== url.origin;
}

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': '*',
	'Access-Control-Expose-Headers': 'Mcp-Session-Id'
} as const;

const paraglideHandle: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
		event.request = localizedRequest;
		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%lang%', locale)
		});
	});

const appHandle: Handle = async ({ event, resolve }) => {
	const pathname = event.url.pathname;
	const isCrossOrigin = isCrossOriginEndpoint(pathname);

	// Handle CORS preflight for MCP-related endpoints
	if (event.request.method === 'OPTIONS' && isCrossOrigin) {
		return new Response(null, { status: 204, headers: CORS_HEADERS });
	}

	// Manual CSRF check for non-exempt routes (replaces SvelteKit's built-in check)
	if (!isCrossOrigin && isOriginMismatch(event.request, event.url)) {
		return new Response('Cross-site POST form submissions are forbidden', { status: 403 });
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
	if (isCrossOrigin) {
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

export const handle = sequence(appHandle, paraglideHandle);

const BOT_PATH_PREFIXES = [
	'/favicon.ico',
	'/.well-known/',
	'/_profiler/',
	'/wp-',
	'/php',
	'/admin',
	'/login',
	'/signin',
	'/signup',
	'/.env',
	'/xmlrpc',
	'/config',
	'/cgi-bin',
	'/_next',
	'/_ignition',
	'/_debugbar',
	'/debugbar',
	'/telescope',
	'/dashboard',
	'/app/',
	'/api-docs',
	'/v2/api-docs',
	'/v3/api-docs',
	'/swagger',
	'/graphql',
	'/.aws',
	'/.s3cfg',
	'/.git',
	'/.svn',
	'/aws-credentials',
	'/security.txt',
	'/env',
	'/backend/',
	'/actuator',
	'/vendor/',
	'/node_modules/',
	'/debug/',
	'/console',
	'/solr/',
	'/manager/',
	'/jmx-console'
];

const BOT_PATH_CONTAINS = ['/.env', '/credentials', '/api-docs'];

export const handleError: HandleServerError = ({ status, event }) => {
	if (status === 404) {
		const path = event.url.pathname;
		const isBotProbe =
			BOT_PATH_PREFIXES.some((p) => path.startsWith(p)) ||
			BOT_PATH_CONTAINS.some((p) => path.includes(p)) ||
			/\.(php|asp|aspx|jsp|cgi|sql|bak|old|orig|swp|log)(\?|$)/.test(path);
		if (isBotProbe) return;
	}
	console.error(`[${status}] ${event.request.method} ${event.url.pathname}`);
};
