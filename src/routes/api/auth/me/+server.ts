import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionWithUser, parseSessionCookie } from '$lib/server/session';
import { toUserProfile } from '$lib/server/users';

export const GET: RequestHandler = async ({ request }) => {
	const sessionId = parseSessionCookie(request.headers.get('cookie'));

	if (!sessionId) {
		return json({ user: null });
	}

	const result = await getSessionWithUser(sessionId);

	if (!result) {
		return json({ user: null });
	}

	return json({ user: toUserProfile(result.user) });
};
