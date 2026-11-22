import type { RequestHandler } from './$types';
import { getSessionWithUser, parseSessionCookie } from '#lib/server/session.ts';
import { toUserProfile } from '#lib/server/users.ts';

export const GET: RequestHandler = async ({ request }) => {
	const sessionId = parseSessionCookie(request.headers.get('cookie'));

	if (!sessionId) {
		return Response.json({ user: null });
	}

	const result = await getSessionWithUser(sessionId);

	if (!result) {
		return Response.json({ user: null });
	}

	return Response.json({ user: toUserProfile(result.user) });
};
