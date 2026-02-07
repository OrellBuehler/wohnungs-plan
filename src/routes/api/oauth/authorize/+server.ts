import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseSessionCookie, getSessionWithUser } from '$lib/server/session';
import {
	getOAuthClient,
	hasAuthorization,
	createAuthorizationCode,
	validateRedirectUri,
	isValidCodeChallengeS256
} from '$lib/server/oauth';

/**
 * Validate redirect URI format according to OAuth 2.0 spec
 * Must be HTTPS or localhost (for development)
 */
function isValidRedirectUriFormat(uri: string): boolean {
	try {
		const url = new URL(uri);
		// Allow HTTPS or localhost (http://localhost or http://127.0.0.1)
		if (url.protocol === 'https:') {
			return true;
		}
		if (url.protocol === 'http:') {
			const isLocalhost =
				url.hostname === 'localhost' ||
				url.hostname === '127.0.0.1' ||
				url.hostname === '[::1]';
			return isLocalhost;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * OAuth 2.0 Authorization Endpoint (RFC 6749 Section 3.1)
 * With PKCE support (RFC 7636)
 *
 * Query parameters:
 * - response_type: Must be "code"
 * - client_id: OAuth client identifier
 * - redirect_uri: Client's redirect URI
 * - state: Opaque value for CSRF protection
 * - code_challenge: PKCE code challenge
 * - code_challenge_method: Must be "S256"
 */
export const GET: RequestHandler = async ({ url, request, cookies }) => {
	// Parse OAuth parameters
	const responseType = url.searchParams.get('response_type');
	const clientId = url.searchParams.get('client_id');
	const redirectUri = url.searchParams.get('redirect_uri');
	const state = url.searchParams.get('state');
	const codeChallenge = url.searchParams.get('code_challenge');
	const codeChallengeMethod = url.searchParams.get('code_challenge_method');

	// Validate required parameters
	if (!clientId || !redirectUri || !state || !codeChallenge || !codeChallengeMethod) {
		return new Response('Missing required OAuth parameters', { status: 400 });
	}

	// Validate response_type
	if (responseType !== 'code') {
		return new Response('Invalid response_type. Must be "code"', { status: 400 });
	}

	// Validate code_challenge_method - only S256 is allowed for security
	if (codeChallengeMethod !== 'S256') {
		return new Response('Invalid code_challenge_method. Must be "S256"', {
			status: 400
		});
	}

	// Validate code_challenge format per RFC 7636
	if (!isValidCodeChallengeS256(codeChallenge)) {
		return new Response(
			'Invalid code_challenge. Must be 43 characters, base64url-encoded (RFC 7636)',
			{ status: 400 }
		);
	}

	// Validate redirect_uri format
	if (!isValidRedirectUriFormat(redirectUri)) {
		return new Response(
			'Invalid redirect_uri. Must be HTTPS or localhost (http://localhost, http://127.0.0.1)',
			{ status: 400 }
		);
	}

	// Validate client exists
	const client = await getOAuthClient(clientId);
	if (!client) {
		return new Response('Invalid client_id', { status: 400 });
	}

	// Validate redirect_uri is registered for this client
	if (!validateRedirectUri(client, redirectUri)) {
		return new Response(
			'Invalid redirect_uri. The URI is not registered for this client.',
			{ status: 400 }
		);
	}

	// Check if user is authenticated
	const sessionId = parseSessionCookie(request.headers.get('cookie'));
	if (!sessionId) {
		// Store OAuth parameters and redirect to login
		const loginUrl = new URL('/login', url.origin);
		loginUrl.searchParams.set('redirect', url.pathname + url.search);
		throw redirect(302, loginUrl.toString());
	}

	const sessionData = await getSessionWithUser(sessionId);
	if (!sessionData) {
		// Invalid/expired session - redirect to login
		const loginUrl = new URL('/login', url.origin);
		loginUrl.searchParams.set('redirect', url.pathname + url.search);
		throw redirect(302, loginUrl.toString());
	}

	const userId = sessionData.user.id;

	// Check if user has already authorized this client
	const authorized = await hasAuthorization(userId, clientId);

	if (!authorized) {
		// User hasn't authorized yet - redirect to consent screen
		const consentUrl = new URL('/oauth/consent', url.origin);
		consentUrl.searchParams.set('client_id', clientId);
		consentUrl.searchParams.set('redirect_uri', redirectUri);
		consentUrl.searchParams.set('state', state);
		consentUrl.searchParams.set('code_challenge', codeChallenge);
		consentUrl.searchParams.set('code_challenge_method', codeChallengeMethod);
		throw redirect(302, consentUrl.toString());
	}

	// User has already authorized - create authorization code and redirect
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

	throw redirect(302, callbackUrl.toString());
};
