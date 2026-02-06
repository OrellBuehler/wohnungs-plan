import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthorizationUrl } from '$lib/server/oidc';
import { isSecureRequest } from '$lib/server/http';

export const GET: RequestHandler = async ({ cookies, url, request }) => {
	// Store returnUrl if provided (for post-login redirect)
	const returnUrl = url.searchParams.get('returnUrl');
	if (returnUrl) {
		cookies.set('auth_return_url', returnUrl, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: isSecureRequest(url, request.headers),
			maxAge: 60 * 10 // 10 minutes
		});
	}

	// Generate and store state for CSRF protection
	const state = crypto.randomUUID();
	cookies.set('oauth_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: isSecureRequest(url, request.headers),
		maxAge: 60 * 10 // 10 minutes
	});

	const authUrl = getAuthorizationUrl(state);
	throw redirect(302, authUrl);
};
