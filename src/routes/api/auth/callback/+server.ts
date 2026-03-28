import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logger } from '$lib/server/logger';
import { exchangeCodeForTokens, getUserInfo } from '$lib/server/oidc';
import { upsertUser } from '$lib/server/users';
import { createSession, createSessionCookie } from '$lib/server/session';
import { isSecureRequest, isSafeRedirectPath } from '$lib/server/http';

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

		// Check for pending OAuth flow
		const oauthPending = cookies.get('oauth_pending');
		if (oauthPending) {
			cookies.delete('oauth_pending', { path: '/' });
			const { clientId, redirectUri, state, codeChallenge, codeChallengeMethod, responseType } =
				JSON.parse(oauthPending);

			// Redirect back to OAuth authorize endpoint
			const authorizeUrl = new URL('/api/oauth/authorize', url.origin);
			authorizeUrl.searchParams.set('response_type', responseType);
			authorizeUrl.searchParams.set('client_id', clientId);
			authorizeUrl.searchParams.set('redirect_uri', redirectUri);
			authorizeUrl.searchParams.set('state', state);
			authorizeUrl.searchParams.set('code_challenge', codeChallenge);
			authorizeUrl.searchParams.set('code_challenge_method', codeChallengeMethod);

			throw redirect(302, authorizeUrl.toString());
		}

		const loginRedirect = cookies.get('login_redirect');
		cookies.delete('login_redirect', { path: '/' });
		const destination =
			loginRedirect && isSafeRedirectPath(loginRedirect) ? loginRedirect : '/?login=success';

		return new Response(null, {
			status: 302,
			headers: {
				Location: destination,
				'Set-Cookie': cookie
			}
		});
	} catch (err) {
		// Re-throw SvelteKit redirects (e.g., OAuth pending flow)
		if (err && typeof err === 'object' && 'status' in err && 'location' in err) {
			throw err;
		}
		logger.error('Auth callback error:', err);
		throw redirect(302, '/?login=error');
	}
};
