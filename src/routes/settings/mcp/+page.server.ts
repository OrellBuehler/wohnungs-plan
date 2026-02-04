import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { parseSessionCookie, getSessionWithUser } from '$lib/server/session';
import { getOrCreateOAuthClient, regenerateClientSecret } from '$lib/server/oauth';
import { config } from '$lib/server/env';

/**
 * Load MCP settings - get or create OAuth credentials
 */
export const load: PageServerLoad = async ({ request, url }) => {
	// Check if user is authenticated
	const sessionId = parseSessionCookie(request.headers.get('cookie'));
	if (!sessionId) {
		// Not authenticated - redirect to login
		const loginUrl = new URL('/login', url.origin);
		loginUrl.searchParams.set('redirect', url.pathname);
		throw redirect(302, loginUrl.toString());
	}

	const sessionData = await getSessionWithUser(sessionId);
	if (!sessionData) {
		// Invalid session - redirect to login
		const loginUrl = new URL('/login', url.origin);
		loginUrl.searchParams.set('redirect', url.pathname);
		throw redirect(302, loginUrl.toString());
	}

	const userId = sessionData.user.id;

	try {
		// Get or create OAuth client for this user
		const { client, secret } = await getOrCreateOAuthClient(userId);

		// Build server URL
		const serverUrl = config.publicUrl
			? `${config.publicUrl}/api/mcp`
			: `${url.origin}/api/mcp`;

		return {
			clientId: client.clientId,
			clientSecret: secret, // Only present for newly created clients
			serverUrl,
			userName: sessionData.user.name
		};
	} catch (error) {
		console.error('Failed to load MCP settings:', error);
		return fail(500, { error: 'Failed to load MCP settings' });
	}
};

/**
 * Handle MCP settings actions
 */
export const actions = {
	/**
	 * Regenerate client secret and invalidate all existing tokens
	 */
	regenerate: async ({ request, url }) => {
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

		try {
			// Regenerate client secret
			const { client, secret } = await regenerateClientSecret(userId);

			// Build server URL
			const serverUrl = config.publicUrl
				? `${config.publicUrl}/api/mcp`
				: `${url.origin}/api/mcp`;

			// Return success with new secret
			return {
				success: true,
				clientId: client.clientId,
				clientSecret: secret,
				serverUrl,
				userName: sessionData.user.name
			};
		} catch (error) {
			console.error('Failed to regenerate client secret:', error);
			return fail(500, { error: 'Failed to regenerate client secret' });
		}
	}
} satisfies Actions;
