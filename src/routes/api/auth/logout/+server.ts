import type { RequestHandler } from './$types';
import { deleteSession, parseSessionCookie, clearSessionCookie } from '$lib/server/session';
import { isSecureRequest } from '$lib/server/http';

export const POST: RequestHandler = async ({ request, url }) => {
	const sessionId = parseSessionCookie(request.headers.get('cookie'));

	if (sessionId) {
		await deleteSession(sessionId);
	}

	return new Response(JSON.stringify({ success: true }), {
		headers: {
			'Content-Type': 'application/json',
			'Set-Cookie': clearSessionCookie({ secure: isSecureRequest(url, request.headers) })
		}
	});
};
