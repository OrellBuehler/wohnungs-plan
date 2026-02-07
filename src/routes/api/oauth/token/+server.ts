import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	verifyOAuthClient,
	getPublicOAuthClient,
	consumeAuthorizationCode,
	createAccessToken,
	ACCESS_TOKEN_LIFETIME_MS,
	isValidCodeVerifier
} from '$lib/server/oauth';

/**
 * OAuth 2.0 Token Endpoint (RFC 6749 Section 3.2)
 * With PKCE support (RFC 7636)
 *
 * Accepts form-encoded POST request with:
 * - grant_type: Must be "authorization_code"
 * - code: Authorization code from authorize endpoint
 * - redirect_uri: Same redirect URI used in authorization request
 * - client_id: OAuth client identifier
 * - client_secret: OAuth client secret
 * - code_verifier: PKCE code verifier
 *
 * Returns JSON response with access_token and metadata
 */
export const POST: RequestHandler = async ({ request }) => {
	// Parse form data
	const formData = await request.formData();
	const grantType = formData.get('grant_type');
	const code = formData.get('code');
	const redirectUri = formData.get('redirect_uri');
	const clientId = formData.get('client_id');
	const clientSecret = formData.get('client_secret');
	const codeVerifier = formData.get('code_verifier');

	// Validate required parameters (client_secret is optional for public clients)
	if (
		!grantType ||
		!code ||
		!redirectUri ||
		!clientId ||
		!codeVerifier ||
		typeof grantType !== 'string' ||
		typeof code !== 'string' ||
		typeof redirectUri !== 'string' ||
		typeof clientId !== 'string' ||
		typeof codeVerifier !== 'string'
	) {
		return json(
			{
				error: 'invalid_request',
				error_description: 'Missing or invalid required parameters'
			},
			{ status: 400 }
		);
	}

	// Validate grant_type
	if (grantType !== 'authorization_code') {
		return json(
			{
				error: 'unsupported_grant_type',
				error_description: 'Only "authorization_code" grant type is supported'
			},
			{ status: 400 }
		);
	}

	// Validate code_verifier format per RFC 7636
	if (!isValidCodeVerifier(codeVerifier)) {
		return json(
			{
				error: 'invalid_request',
				error_description:
					'Invalid code_verifier. Must be 43-128 characters, unreserved characters only (RFC 7636)'
			},
			{ status: 400 }
		);
	}

	// Verify client: confidential clients use secret, public clients use PKCE only
	let client;
	if (clientSecret && typeof clientSecret === 'string') {
		client = await verifyOAuthClient(clientId, clientSecret);
	} else {
		client = await getPublicOAuthClient(clientId);
	}

	if (!client) {
		console.error('[SECURITY] Failed client authentication', {
			clientId,
			ip: request.headers.get('x-forwarded-for') || 'unknown'
		});
		return json(
			{
				error: 'invalid_client',
				error_description: 'Invalid client credentials'
			},
			{ status: 401 }
		);
	}

	// Consume authorization code with PKCE verification
	const userId = await consumeAuthorizationCode(code, clientId, redirectUri, codeVerifier);

	if (!userId) {
		console.error('[SECURITY] Failed authorization code exchange', {
			clientId,
			ip: request.headers.get('x-forwarded-for') || 'unknown'
		});
		return json(
			{
				error: 'invalid_grant',
				error_description:
					'Invalid or expired authorization code, or PKCE verification failed'
			},
			{ status: 400 }
		);
	}

	// Create access token
	const accessToken = await createAccessToken(userId, clientId);

	// Calculate expiration timestamp
	const expiresIn = Math.floor(ACCESS_TOKEN_LIFETIME_MS / 1000); // Convert to seconds

	// Return OAuth token response
	return json(
		{
			access_token: accessToken,
			token_type: 'Bearer',
			expires_in: expiresIn
		},
		{
			status: 200,
			headers: {
				'Cache-Control': 'no-store',
				Pragma: 'no-cache'
			}
		}
	);
};
