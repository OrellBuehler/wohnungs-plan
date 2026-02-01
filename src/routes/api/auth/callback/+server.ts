import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exchangeCodeForTokens, getUserInfo } from '$lib/server/oidc';
import { upsertUser } from '$lib/server/users';
import { createSession, createSessionCookie } from '$lib/server/session';
import { isSecureRequest } from '$lib/server/http';

export const GET: RequestHandler = async ({ url, cookies, request }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const storedState = cookies.get('oauth_state');

	// Clear the state cookie
	cookies.delete('oauth_state', { path: '/' });

	// Validate state
	if (!state || state !== storedState) {
		throw error(400, 'Invalid state parameter');
	}

	if (!code) {
		throw error(400, 'Missing authorization code');
	}

	try {
		// Exchange code for tokens
		const tokens = await exchangeCodeForTokens(code);

		// Get user info
		const userInfo = await getUserInfo(tokens.access_token);

		// Create or update user
		const user = await upsertUser({
			infomaniakSub: userInfo.sub,
			email: userInfo.email,
			name: userInfo.name,
			avatarUrl: userInfo.picture
		});

		// Create session
		const session = await createSession(user.id, tokens.refresh_token);

		// Set session cookie
		const cookie = createSessionCookie(session.id, {
			secure: isSecureRequest(url, request.headers)
		});

		return new Response(null, {
			status: 302,
			headers: {
				Location: '/?login=success',
				'Set-Cookie': cookie
			}
		});
	} catch (err) {
		console.error('Auth callback error:', err);
		throw redirect(302, '/?login=error');
	}
};
