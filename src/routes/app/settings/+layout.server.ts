import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { parseSessionCookie, getSessionWithUser } from '$lib/server/session';

export const load: LayoutServerLoad = async ({ request, url }) => {
	const sessionId = parseSessionCookie(request.headers.get('cookie'));
	if (!sessionId) {
		const loginUrl = new URL('/api/auth/login', url.origin);
		loginUrl.searchParams.set('redirect', url.pathname);
		throw redirect(302, loginUrl.toString());
	}

	const sessionData = await getSessionWithUser(sessionId);
	if (!sessionData) {
		const loginUrl = new URL('/api/auth/login', url.origin);
		loginUrl.searchParams.set('redirect', url.pathname);
		throw redirect(302, loginUrl.toString());
	}

	return {
		user: {
			id: sessionData.user.id,
			name: sessionData.user.name,
			email: sessionData.user.email,
			avatarUrl: sessionData.user.avatarUrl
		}
	};
};
