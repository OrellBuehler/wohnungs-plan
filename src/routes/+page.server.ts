import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { parseSessionCookie, getSessionWithUser } from '$lib/server/session';

export const load: PageServerLoad = async ({ request }) => {
	const sessionId = parseSessionCookie(request.headers.get('cookie'));
	if (sessionId) {
		const session = await getSessionWithUser(sessionId);
		if (session) {
			throw redirect(302, '/app');
		}
	}
	return {};
};
