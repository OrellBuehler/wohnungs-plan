import type { Handle } from '@sveltejs/kit';
import { getSessionWithUser, parseSessionCookie } from '$lib/server/session';
import { runMigrations } from '$lib/server/db';

// Run migrations on server startup
export async function init() {
	await runMigrations();
}

export const handle: Handle = async ({ event, resolve }) => {
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

	return resolve(event);
};
