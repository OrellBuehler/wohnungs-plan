import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { parseSessionCookie, getSessionWithUser } from '$lib/server/session';
import { getOAuthClient, createAuthorization, createAuthorizationCode } from '$lib/server/oauth';

/**
 * Load consent screen - verify authentication and client
 */
export const load: PageServerLoad = async ({ url, request }) => {
	// Get OAuth parameters from URL
	const clientId = url.searchParams.get('client_id');
	const redirectUri = url.searchParams.get('redirect_uri');
	const state = url.searchParams.get('state');
	const codeChallenge = url.searchParams.get('code_challenge');
	const codeChallengeMethod = url.searchParams.get('code_challenge_method');

	// Validate required parameters
	if (!clientId || !redirectUri || !state || !codeChallenge || !codeChallengeMethod) {
		throw redirect(302, '/?error=invalid_oauth_request');
	}

	// Check if user is authenticated
	const sessionId = parseSessionCookie(request.headers.get('cookie'));
	if (!sessionId) {
		// Not authenticated - redirect to login with OAuth params preserved
		const loginUrl = new URL('/login', url.origin);
		loginUrl.searchParams.set('redirect', url.pathname + url.search);
		throw redirect(302, loginUrl.toString());
	}

	const sessionData = await getSessionWithUser(sessionId);
	if (!sessionData) {
		// Invalid session - redirect to login
		const loginUrl = new URL('/login', url.origin);
		loginUrl.searchParams.set('redirect', url.pathname + url.search);
		throw redirect(302, loginUrl.toString());
	}

	// Validate client exists
	const client = await getOAuthClient(clientId);
	if (!client) {
		throw redirect(302, '/?error=invalid_client');
	}

	// Return data needed for consent screen
	return {
		clientId,
		redirectUri,
		state,
		codeChallenge,
		codeChallengeMethod
	};
};

/**
 * Handle consent screen actions
 */
export const actions = {
	/**
	 * User approved the authorization request
	 */
	approve: async ({ url, request, cookies }) => {
		// Get OAuth parameters from form data
		const formData = await request.formData();
		const clientId = formData.get('client_id')?.toString();
		const redirectUri = formData.get('redirect_uri')?.toString();
		const state = formData.get('state')?.toString();
		const codeChallenge = formData.get('code_challenge')?.toString();
		const codeChallengeMethod = formData.get('code_challenge_method')?.toString();

		// Validate parameters
		if (!clientId || !redirectUri || !state || !codeChallenge || !codeChallengeMethod) {
			return fail(400, { error: 'Missing required parameters' });
		}

		// Verify code challenge method
		if (codeChallengeMethod !== 'S256' && codeChallengeMethod !== 'plain') {
			return fail(400, { error: 'Invalid code_challenge_method' });
		}

		// Get current user
		const sessionId = parseSessionCookie(request.headers.get('cookie'));
		if (!sessionId) {
			return fail(401, { error: 'Not authenticated' });
		}

		const sessionData = await getSessionWithUser(sessionId);
		if (!sessionData) {
			return fail(401, { error: 'Invalid session' });
		}

		const userId = sessionData.user.id;

		// Verify client exists
		const client = await getOAuthClient(clientId);
		if (!client) {
			return fail(400, { error: 'Invalid client' });
		}

		try {
			// Create authorization record
			await createAuthorization(userId, clientId);

			// Create authorization code
			const code = await createAuthorizationCode(
				userId,
				clientId,
				redirectUri,
				codeChallenge
			);

			// Build redirect URL with authorization code
			const callbackUrl = new URL(redirectUri);
			callbackUrl.searchParams.set('code', code);
			callbackUrl.searchParams.set('state', state);

			// Redirect back to client
			throw redirect(302, callbackUrl.toString());
		} catch (error) {
			console.error('Failed to approve authorization:', error);
			return fail(500, { error: 'Failed to complete authorization' });
		}
	},

	/**
	 * User denied the authorization request
	 */
	deny: async ({ request, cookies }) => {
		// Get redirect_uri from form data
		const formData = await request.formData();
		const redirectUri = formData.get('redirect_uri')?.toString();
		const state = formData.get('state')?.toString();

		// If we have redirect_uri and state, redirect back to client with error
		if (redirectUri && state) {
			const callbackUrl = new URL(redirectUri);
			callbackUrl.searchParams.set('error', 'access_denied');
			callbackUrl.searchParams.set('error_description', 'User denied authorization');
			callbackUrl.searchParams.set('state', state);

			throw redirect(302, callbackUrl.toString());
		}

		// Otherwise redirect to home
		throw redirect(302, '/');
	}
} satisfies Actions;
