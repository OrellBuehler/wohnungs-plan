import { randomBytes, createHash } from 'crypto';
import { compareSync, hashSync } from 'bcrypt';
import { eq, and, gt, lt } from 'drizzle-orm';
import {
	getDB,
	oauthClients,
	oauthTokens,
	oauthAuthorizations,
	oauthAuthorizationCodes,
	type OAuthClient,
	type NewOAuthClient,
	type OAuthAuthorization,
	type NewOAuthAuthorization,
	type OAuthAuthorizationCode,
	type NewOAuthAuthorizationCode
} from './db';

// Constants
export const SALT_ROUNDS = 10;
export const ACCESS_TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const AUTH_CODE_LIFETIME_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generate a secure random token
 * @param bytes Number of random bytes to generate (default: 32)
 * @returns Base64url-encoded token
 */
export function generateToken(bytes: number = 32): string {
	return randomBytes(bytes).toString('base64url');
}

/**
 * Generate a URL-safe client ID
 * @returns Client ID (24 bytes = 32 chars base64url)
 */
export function generateClientId(): string {
	return generateToken(24);
}

/**
 * Generate a client secret
 * @returns Client secret (32 bytes = 43 chars base64url)
 */
export function generateClientSecret(): string {
	return generateToken(32);
}

/**
 * Hash a token using bcrypt
 * @param token Token to hash
 * @returns Bcrypt hash
 */
export function hashToken(token: string): string {
	return hashSync(token, SALT_ROUNDS);
}

/**
 * Verify a token against a bcrypt hash
 * @param token Token to verify
 * @param hash Bcrypt hash to compare against
 * @returns True if token matches hash
 */
export function verifyToken(token: string, hash: string): boolean {
	return compareSync(token, hash);
}

/**
 * Verify PKCE code challenge (S256 only for security)
 * @param codeVerifier The code verifier sent by the client
 * @param codeChallenge The code challenge stored during authorization
 * @returns True if verification succeeds
 */
export function verifyPKCE(codeVerifier: string, codeChallenge: string): boolean {
	// S256: BASE64URL(SHA256(ASCII(code_verifier)))
	const hash = createHash('sha256').update(codeVerifier).digest('base64url');
	return hash === codeChallenge;
}

/**
 * Get existing OAuth client for user, or create a new one
 * @param userId User ID to get/create client for
 * @returns Object with client record and plaintext secret (only for new clients)
 */
export async function getOrCreateOAuthClient(
	userId: string
): Promise<{ client: OAuthClient; secret?: string }> {
	const db = getDB();

	// Check if user already has a client
	const existing = await db.query.oauthClients.findFirst({
		where: eq(oauthClients.userId, userId)
	});

	if (existing) {
		return { client: existing };
	}

	// Create new client
	const clientId = generateClientId();
	const clientSecret = generateClientSecret();
	const clientSecretHash = hashToken(clientSecret);

	const newClient: NewOAuthClient = {
		userId,
		clientId,
		clientSecretHash
	};

	const [client] = await db.insert(oauthClients).values(newClient).returning();

	return {
		client,
		secret: clientSecret // Return plaintext secret only on creation
	};
}

/**
 * Get OAuth client by client ID
 * @param clientId Client ID to look up
 * @returns OAuth client or undefined
 */
export async function getOAuthClient(clientId: string): Promise<OAuthClient | undefined> {
	const db = getDB();
	return db.query.oauthClients.findFirst({
		where: eq(oauthClients.clientId, clientId)
	});
}

/**
 * Verify OAuth client credentials
 * @param clientId Client ID
 * @param clientSecret Client secret (plaintext)
 * @returns OAuth client if credentials are valid, undefined otherwise
 */
export async function verifyOAuthClient(
	clientId: string,
	clientSecret: string
): Promise<OAuthClient | undefined> {
	const client = await getOAuthClient(clientId);

	if (!client) {
		return undefined;
	}

	const isValid = verifyToken(clientSecret, client.clientSecretHash);
	return isValid ? client : undefined;
}

/**
 * Regenerate client secret and invalidate all existing tokens
 * @param userId User ID whose client secret to regenerate
 * @returns Object with updated client and new plaintext secret
 */
export async function regenerateClientSecret(
	userId: string
): Promise<{ client: OAuthClient; secret: string }> {
	const db = getDB();

	// Get existing client
	const existing = await db.query.oauthClients.findFirst({
		where: eq(oauthClients.userId, userId)
	});

	if (!existing) {
		throw new Error('No OAuth client found for user');
	}

	// Generate new secret
	const clientSecret = generateClientSecret();
	const clientSecretHash = hashToken(clientSecret);

	// Update client with new secret
	const [client] = await db
		.update(oauthClients)
		.set({ clientSecretHash })
		.where(eq(oauthClients.userId, userId))
		.returning();

	// Delete all existing tokens for this client
	await db.delete(oauthTokens).where(eq(oauthTokens.clientId, existing.clientId));

	return {
		client,
		secret: clientSecret
	};
}

/**
 * Add an allowed redirect URI to a client
 * @param clientId Client ID
 * @param redirectUri Redirect URI to add
 * @returns Updated client
 */
export async function addAllowedRedirectUri(
	clientId: string,
	redirectUri: string
): Promise<OAuthClient> {
	const db = getDB();

	const client = await getOAuthClient(clientId);
	if (!client) {
		throw new Error('OAuth client not found');
	}

	// Normalize the URI (remove trailing slash)
	const normalizedUri = redirectUri.replace(/\/$/, '');

	// Check if already in list
	if (client.allowedRedirectUris.includes(normalizedUri)) {
		return client;
	}

	const [updated] = await db
		.update(oauthClients)
		.set({
			allowedRedirectUris: [...client.allowedRedirectUris, normalizedUri]
		})
		.where(eq(oauthClients.clientId, clientId))
		.returning();

	return updated;
}

/**
 * Validate that a redirect URI is allowed for a client
 * @param client OAuth client
 * @param redirectUri Redirect URI to validate
 * @returns True if redirect URI is allowed
 */
export function validateRedirectUri(client: OAuthClient, redirectUri: string): boolean {
	// Normalize the URI (remove trailing slash)
	const normalizedUri = redirectUri.replace(/\/$/, '');

	// Exact match required per OAuth 2.0 spec
	return client.allowedRedirectUris.includes(normalizedUri);
}

/**
 * Check if user has authorized a client
 * @param userId User ID
 * @param clientId Client ID
 * @returns True if authorization exists
 */
export async function hasAuthorization(userId: string, clientId: string): Promise<boolean> {
	const db = getDB();
	const authorization = await db.query.oauthAuthorizations.findFirst({
		where: and(
			eq(oauthAuthorizations.userId, userId),
			eq(oauthAuthorizations.clientId, clientId)
		)
	});
	return !!authorization;
}

/**
 * Create an authorization record for a user/client pair
 * @param userId User ID
 * @param clientId Client ID
 * @returns Created authorization record
 */
export async function createAuthorization(
	userId: string,
	clientId: string
): Promise<OAuthAuthorization> {
	const db = getDB();

	// Check if authorization already exists
	const existing = await db.query.oauthAuthorizations.findFirst({
		where: and(
			eq(oauthAuthorizations.userId, userId),
			eq(oauthAuthorizations.clientId, clientId)
		)
	});

	if (existing) {
		return existing;
	}

	// Create new authorization
	const newAuth: NewOAuthAuthorization = {
		userId,
		clientId
	};

	const [authorization] = await db.insert(oauthAuthorizations).values(newAuth).returning();
	return authorization;
}

/**
 * Create an authorization code for PKCE flow
 * @param userId User ID
 * @param clientId Client ID
 * @param redirectUri Redirect URI
 * @param codeChallenge PKCE code challenge
 * @returns Authorization code (plaintext)
 */
export async function createAuthorizationCode(
	userId: string,
	clientId: string,
	redirectUri: string,
	codeChallenge: string
): Promise<string> {
	const db = getDB();

	// Generate authorization code
	const code = generateToken(32);

	// Calculate expiration time
	const expiresAt = new Date(Date.now() + AUTH_CODE_LIFETIME_MS);

	const newCode: NewOAuthAuthorizationCode = {
		code,
		clientId,
		userId,
		redirectUri,
		codeChallenge,
		codeChallengeMethod: 'S256', // Only S256 is allowed for security
		expiresAt
	};

	await db.insert(oauthAuthorizationCodes).values(newCode);

	return code;
}

/**
 * Consume an authorization code (one-time use with PKCE verification)
 * @param code Authorization code
 * @param clientId Client ID
 * @param redirectUri Redirect URI
 * @param codeVerifier PKCE code verifier
 * @returns User ID if code is valid, undefined otherwise
 */
export async function consumeAuthorizationCode(
	code: string,
	clientId: string,
	redirectUri: string,
	codeVerifier: string
): Promise<string | undefined> {
	const db = getDB();

	// Find the code
	const authCode = await db.query.oauthAuthorizationCodes.findFirst({
		where: eq(oauthAuthorizationCodes.code, code)
	});

	if (!authCode) {
		return undefined;
	}

	// Verify code hasn't been used
	if (authCode.usedAt) {
		return undefined;
	}

	// Verify code hasn't expired
	if (authCode.expiresAt < new Date()) {
		return undefined;
	}

	// Verify client ID matches
	if (authCode.clientId !== clientId) {
		return undefined;
	}

	// Verify redirect URI matches
	if (authCode.redirectUri !== redirectUri) {
		return undefined;
	}

	// Verify PKCE code challenge (S256 only)
	const pkceValid = verifyPKCE(codeVerifier, authCode.codeChallenge);

	if (!pkceValid) {
		return undefined;
	}

	// Mark code as used
	await db
		.update(oauthAuthorizationCodes)
		.set({ usedAt: new Date() })
		.where(eq(oauthAuthorizationCodes.code, code));

	return authCode.userId;
}

/**
 * Create an access token for a user/client pair
 * @param userId User ID
 * @param clientId Client ID
 * @returns Access token (plaintext)
 */
export async function createAccessToken(userId: string, clientId: string): Promise<string> {
	const db = getDB();

	// Generate access token
	const token = generateToken(32);
	const accessTokenHash = hashToken(token);

	// Calculate expiration time
	const expiresAt = new Date(Date.now() + ACCESS_TOKEN_LIFETIME_MS);

	await db.insert(oauthTokens).values({
		accessTokenHash,
		clientId,
		userId,
		expiresAt
	});

	return token;
}

/**
 * Validate an access token and return associated data
 * @param token Access token (plaintext)
 * @returns Object with userId and clientId if valid, undefined otherwise
 */
export async function validateAccessToken(
	token: string
): Promise<{ userId: string; clientId: string } | undefined> {
	const db = getDB();

	// Get all non-expired tokens
	const now = new Date();
	const tokens = await db.query.oauthTokens.findMany({
		where: gt(oauthTokens.expiresAt, now)
	});

	// Find matching token by comparing hash
	for (const tokenRecord of tokens) {
		if (verifyToken(token, tokenRecord.accessTokenHash)) {
			return {
				userId: tokenRecord.userId,
				clientId: tokenRecord.clientId
			};
		}
	}

	return undefined;
}

/**
 * Revoke all access tokens for a client
 * @param clientId Client ID
 */
export async function revokeClientTokens(clientId: string): Promise<void> {
	const db = getDB();
	await db.delete(oauthTokens).where(eq(oauthTokens.clientId, clientId));
}

/**
 * Clean up expired OAuth data (tokens and authorization codes)
 * Should be run periodically (e.g., daily cron job)
 */
export async function cleanupExpiredOAuthData(): Promise<void> {
	const db = getDB();
	const now = new Date();

	// Delete expired tokens
	await db.delete(oauthTokens).where(lt(oauthTokens.expiresAt, now));

	// Delete expired authorization codes
	await db.delete(oauthAuthorizationCodes).where(lt(oauthAuthorizationCodes.expiresAt, now));
}
