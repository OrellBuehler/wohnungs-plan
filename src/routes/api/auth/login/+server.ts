import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthorizationUrl } from '$lib/server/oidc';
import { isSecureRequest } from '$lib/server/http';

function isSafeRedirectPath(value: string): boolean {
	if (!value.startsWith('/')) return false;
	if (value.startsWith('//')) return false;
	if (value.includes('://')) return false;
	return true;
}

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
	if (redirectPath && isSafeRedirectPath(redirectPath)) {
		cookies.set('login_redirect', redirectPath, {
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
