import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthorizationUrl } from '$lib/server/oidc';
import { isSecureRequest, isSafeRedirectPath } from '$lib/server/http';

export const GET: RequestHandler = async ({ cookies, url, request }) => {
	// Generate and store state for CSRF protection
	const state = crypto.randomUUID();
	const secure = isSecureRequest(url, request.headers);

	cookies.set('oauth_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure,
		maxAge: 60 * 10 // 10 minutes
	});

	const redirectPath = url.searchParams.get('redirect');
	const reason = url.searchParams.get('reason');

	let destination = redirectPath && isSafeRedirectPath(redirectPath) ? redirectPath : null;
	if (reason) {
		if (destination) {
			const dest = new URL(destination, 'http://x');
			dest.searchParams.set('reason', reason);
			destination = dest.pathname + dest.search;
		} else {
			destination = `/?reason=${encodeURIComponent(reason)}`;
		}
	}

	if (destination) {
		cookies.set('login_redirect', destination, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure,
			maxAge: 60 * 10 // 10 minutes
		});
	}

	const authUrl = getAuthorizationUrl(state);
	throw redirect(302, authUrl);
};
