import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { parseSessionCookie, getSessionWithUser } from '$lib/server/session';
import { getOrCreateOAuthClient, regenerateClientSecret, addAllowedRedirectUri } from '$lib/server/oauth';
import { getDB, oauthClients } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { config } from '$lib/server/env';

export const load: PageServerLoad = async ({ parent, url }) => {
	const { user } = await parent();
	const userId = user.id;

	try {
		// Get or create OAuth client for this user
		const { client, secret } = await getOrCreateOAuthClient(userId);

		// Build server URL
		const serverUrl = config.publicUrl
			? `${config.publicUrl}/api/mcp`
			: `${url.origin}/api/mcp`;

		return {
			clientId: client.clientId,
			clientSecret: secret,
			serverUrl,
			allowedRedirectUris: client.allowedRedirectUris
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
				serverUrl
			};
		} catch (error) {
			console.error('Failed to regenerate client secret:', error);
			return fail(500, { error: 'Failed to regenerate client secret' });
		}
	},

	/**
	 * Add an allowed redirect URI
	 */
	addRedirectUri: async ({ request }) => {
		// Get current user
		const sessionId = parseSessionCookie(request.headers.get('cookie'));
		if (!sessionId) {
			return fail(401, { error: 'Not authenticated' });
		}

		const sessionData = await getSessionWithUser(sessionId);
		if (!sessionData) {
			return fail(401, { error: 'Invalid session' });
		}

		const formData = await request.formData();
		const redirectUri = formData.get('redirectUri')?.toString().trim();

		if (!redirectUri) {
			return fail(400, { error: 'Redirect URI is required' });
		}

		// Validate URI format
		try {
			const url = new URL(redirectUri);
			const isHttps = url.protocol === 'https:';
			const isLocalhost = url.protocol === 'http:' &&
				(url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]');

			if (!isHttps && !isLocalhost) {
				return fail(400, { error: 'Redirect URI must be HTTPS or localhost' });
			}
		} catch {
			return fail(400, { error: 'Invalid URL format' });
		}

		try {
			// Get user's client
			const db = getDB();
			const [client] = await db
				.select()
				.from(oauthClients)
				.where(eq(oauthClients.userId, sessionData.user.id))
				.limit(1);

			if (!client) {
				return fail(404, { error: 'OAuth client not found' });
			}

			await addAllowedRedirectUri(client.clientId, redirectUri);

			return { success: true, action: 'addRedirectUri' };
		} catch (error) {
			console.error('Failed to add redirect URI:', error);
			return fail(500, { error: 'Failed to add redirect URI' });
		}
	},

	/**
	 * Remove an allowed redirect URI
	 */
	removeRedirectUri: async ({ request }) => {
		// Get current user
		const sessionId = parseSessionCookie(request.headers.get('cookie'));
		if (!sessionId) {
			return fail(401, { error: 'Not authenticated' });
		}

		const sessionData = await getSessionWithUser(sessionId);
		if (!sessionData) {
			return fail(401, { error: 'Invalid session' });
		}

		const formData = await request.formData();
		const redirectUri = formData.get('redirectUri')?.toString();

		if (!redirectUri) {
			return fail(400, { error: 'Redirect URI is required' });
		}

		try {
			const db = getDB();
			const [client] = await db
				.select()
				.from(oauthClients)
				.where(eq(oauthClients.userId, sessionData.user.id))
				.limit(1);

			if (!client) {
				return fail(404, { error: 'OAuth client not found' });
			}

			// Remove URI from list
			const normalizedUri = redirectUri.replace(/\/$/, '');
			const updatedUris = client.allowedRedirectUris.filter(uri => uri !== normalizedUri);

			await db
				.update(oauthClients)
				.set({ allowedRedirectUris: updatedUris })
				.where(eq(oauthClients.clientId, client.clientId));

			return { success: true, action: 'removeRedirectUri' };
		} catch (error) {
			console.error('Failed to remove redirect URI:', error);
			return fail(500, { error: 'Failed to remove redirect URI' });
		}
	}
} satisfies Actions;
