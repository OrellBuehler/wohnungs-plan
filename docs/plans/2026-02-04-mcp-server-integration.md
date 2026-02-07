# MCP Server Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an OAuth-authenticated MCP server embedded in the SvelteKit app to enable AI assistants to add furniture items to projects.

**Architecture:** The implementation adds four database tables (OAuth clients, authorizations, tokens, codes), three OAuth endpoints (/api/oauth/*), one MCP endpoint (/api/mcp), authentication middleware, MCP tools (list_projects, add_furniture_item), and a settings UI for managing credentials.

**Tech Stack:** SvelteKit, Drizzle ORM (PostgreSQL), @modelcontextprotocol/sdk, bcrypt (password hashing), zod (validation)

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install MCP SDK and bcrypt**

```bash
bun add @modelcontextprotocol/sdk bcrypt
bun add -d @types/bcrypt
```

Expected: Dependencies added to package.json

**Step 2: Verify installation**

Run: `bun install`
Expected: All packages installed successfully

**Step 3: Commit**

```bash
git add package.json bun.lockb
git commit -m "deps: add MCP SDK and bcrypt for OAuth implementation"
```

---

## Task 2: Database Schema - OAuth Tables

**Files:**
- Modify: `src/lib/server/schema.ts`

**Step 1: Add OAuth tables to schema**

Add after the `projectInvites` table definition (line 148):

```typescript
// OAuth Clients - one per user for MCP access
export const oauthClients = pgTable(
	'oauth_clients',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		clientId: text('client_id').unique().notNull(),
		clientSecretHash: text('client_secret_hash').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
	},
	(table) => [
		index('idx_oauth_clients_user_id').on(table.userId),
		index('idx_oauth_clients_client_id').on(table.clientId)
	]
);

// OAuth Authorizations - tracks which clients user has approved
export const oauthAuthorizations = pgTable(
	'oauth_authorizations',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		clientId: text('client_id')
			.notNull()
			.references(() => oauthClients.clientId, { onDelete: 'cascade' }),
		approvedAt: timestamp('approved_at', { withTimezone: true }).defaultNow()
	},
	(table) => [
		index('idx_oauth_authorizations_user_id').on(table.userId),
		index('idx_oauth_authorizations_client_id').on(table.clientId)
	]
);

// OAuth Tokens - access and refresh tokens
export const oauthTokens = pgTable(
	'oauth_tokens',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		clientId: text('client_id')
			.notNull()
			.references(() => oauthClients.clientId, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		accessTokenHash: text('access_token_hash').notNull(),
		refreshTokenHash: text('refresh_token_hash'),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		scopes: text('scopes').array().notNull().default(sql`ARRAY['mcp:access']::text[]`),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
	},
	(table) => [
		index('idx_oauth_tokens_client_id').on(table.clientId),
		index('idx_oauth_tokens_user_id').on(table.userId),
		index('idx_oauth_tokens_expires_at').on(table.expiresAt)
	]
);

// OAuth Authorization Codes - short-lived codes for PKCE flow
export const oauthAuthorizationCodes = pgTable(
	'oauth_authorization_codes',
	{
		code: text('code').primaryKey(),
		clientId: text('client_id')
			.notNull()
			.references(() => oauthClients.clientId, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		redirectUri: text('redirect_uri').notNull(),
		codeChallenge: text('code_challenge').notNull(),
		codeChallengeMethod: text('code_challenge_method').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
	},
	(table) => [
		index('idx_oauth_codes_client_id').on(table.clientId),
		index('idx_oauth_codes_expires_at').on(table.expiresAt),
		check('oauth_codes_method_check', sql`code_challenge_method IN ('S256', 'plain')`)
	]
);
```

**Step 2: Add type exports**

Add after the existing type exports (line 164):

```typescript
export type OAuthClient = typeof oauthClients.$inferSelect;
export type NewOAuthClient = typeof oauthClients.$inferInsert;
export type OAuthAuthorization = typeof oauthAuthorizations.$inferSelect;
export type NewOAuthAuthorization = typeof oauthAuthorizations.$inferInsert;
export type OAuthToken = typeof oauthTokens.$inferSelect;
export type NewOAuthToken = typeof oauthTokens.$inferInsert;
export type OAuthAuthorizationCode = typeof oauthAuthorizationCodes.$inferSelect;
export type NewOAuthAuthorizationCode = typeof oauthAuthorizationCodes.$inferInsert;
```

**Step 3: Generate migration**

Run: `bun db:generate`
Expected: New migration file created in `drizzle/` directory

**Step 4: Run migration**

Run: `bun db:migrate`
Expected: Migration applied successfully, tables created

**Step 5: Commit**

```bash
git add src/lib/server/schema.ts drizzle/
git commit -m "feat: add OAuth database schema for MCP authentication"
```

---

## Task 3: OAuth Service - Client Management

**Files:**
- Create: `src/lib/server/oauth.ts`

**Step 1: Create OAuth service with client management**

```typescript
import { eq, and, gt, lt } from 'drizzle-orm';
import {
	getDB,
	oauthClients,
	oauthAuthorizations,
	oauthTokens,
	oauthAuthorizationCodes,
	type OAuthClient,
	type OAuthAuthorization,
	type OAuthToken,
	type OAuthAuthorizationCode
} from './db';
import { compareSync, hashSync } from 'bcrypt';
import { createHash, randomBytes } from 'crypto';

const SALT_ROUNDS = 10;
const ACCESS_TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const AUTH_CODE_LIFETIME_MS = 10 * 60 * 1000; // 10 minutes

// Generate secure random token
export function generateToken(bytes: number = 32): string {
	return randomBytes(bytes).toString('base64url');
}

// Generate client ID (URL-safe, 32 chars)
export function generateClientId(): string {
	return randomBytes(24).toString('base64url');
}

// Generate client secret (longer, more entropy)
export function generateClientSecret(): string {
	return randomBytes(48).toString('base64url');
}

// Hash token for storage
export function hashToken(token: string): string {
	return hashSync(token, SALT_ROUNDS);
}

// Verify token against hash
export function verifyToken(token: string, hash: string): boolean {
	return compareSync(token, hash);
}

// Verify PKCE code challenge
export function verifyPKCE(codeVerifier: string, codeChallenge: string, method: string): boolean {
	if (method === 'plain') {
		return codeVerifier === codeChallenge;
	}
	if (method === 'S256') {
		const hash = createHash('sha256').update(codeVerifier).digest('base64url');
		return hash === codeChallenge;
	}
	return false;
}

// Get or create OAuth client for user
export async function getOrCreateOAuthClient(
	userId: string
): Promise<{ client: OAuthClient; secret: string | null }> {
	const db = getDB();

	// Check if client exists
	const [existing] = await db
		.select()
		.from(oauthClients)
		.where(eq(oauthClients.userId, userId))
		.limit(1);

	if (existing) {
		return { client: existing, secret: null };
	}

	// Create new client
	const clientId = generateClientId();
	const clientSecret = generateClientSecret();
	const clientSecretHash = hashToken(clientSecret);

	const [client] = await db
		.insert(oauthClients)
		.values({
			userId,
			clientId,
			clientSecretHash
		})
		.returning();

	return { client, secret: clientSecret };
}

// Get OAuth client by client ID
export async function getOAuthClient(clientId: string): Promise<OAuthClient | null> {
	const db = getDB();
	const [client] = await db
		.select()
		.from(oauthClients)
		.where(eq(oauthClients.clientId, clientId))
		.limit(1);

	return client || null;
}

// Verify client credentials
export async function verifyOAuthClient(
	clientId: string,
	clientSecret: string
): Promise<OAuthClient | null> {
	const client = await getOAuthClient(clientId);
	if (!client) return null;

	if (!verifyToken(clientSecret, client.clientSecretHash)) {
		return null;
	}

	return client;
}

// Regenerate client secret
export async function regenerateClientSecret(userId: string): Promise<string> {
	const db = getDB();
	const newSecret = generateClientSecret();
	const newSecretHash = hashToken(newSecret);

	await db
		.update(oauthClients)
		.set({ clientSecretHash: newSecretHash })
		.where(eq(oauthClients.userId, userId));

	// Invalidate all tokens for this user's client
	const [client] = await db
		.select()
		.from(oauthClients)
		.where(eq(oauthClients.userId, userId))
		.limit(1);

	if (client) {
		await db.delete(oauthTokens).where(eq(oauthTokens.clientId, client.clientId));
	}

	return newSecret;
}
```

**Step 2: Commit**

```bash
git add src/lib/server/oauth.ts
git commit -m "feat: add OAuth client management service"
```

---

## Task 4: OAuth Service - Authorization Flow

**Files:**
- Modify: `src/lib/server/oauth.ts`

**Step 1: Add authorization functions**

Add to `src/lib/server/oauth.ts`:

```typescript
// Check if user has authorized a client
export async function hasAuthorization(userId: string, clientId: string): Promise<boolean> {
	const db = getDB();
	const [auth] = await db
		.select()
		.from(oauthAuthorizations)
		.where(
			and(eq(oauthAuthorizations.userId, userId), eq(oauthAuthorizations.clientId, clientId))
		)
		.limit(1);

	return !!auth;
}

// Create authorization
export async function createAuthorization(
	userId: string,
	clientId: string
): Promise<OAuthAuthorization> {
	const db = getDB();

	// Check if already exists
	const [existing] = await db
		.select()
		.from(oauthAuthorizations)
		.where(
			and(eq(oauthAuthorizations.userId, userId), eq(oauthAuthorizations.clientId, clientId))
		)
		.limit(1);

	if (existing) return existing;

	// Create new
	const [auth] = await db
		.insert(oauthAuthorizations)
		.values({ userId, clientId })
		.returning();

	return auth;
}

// Create authorization code
export async function createAuthorizationCode(
	userId: string,
	clientId: string,
	redirectUri: string,
	codeChallenge: string,
	codeChallengeMethod: string
): Promise<string> {
	const db = getDB();
	const code = generateToken(32);
	const expiresAt = new Date(Date.now() + AUTH_CODE_LIFETIME_MS);

	await db.insert(oauthAuthorizationCodes).values({
		code,
		userId,
		clientId,
		redirectUri,
		codeChallenge,
		codeChallengeMethod,
		expiresAt
	});

	return code;
}

// Verify and consume authorization code
export async function consumeAuthorizationCode(
	code: string,
	clientId: string,
	redirectUri: string,
	codeVerifier: string
): Promise<{ userId: string } | null> {
	const db = getDB();

	const [authCode] = await db
		.select()
		.from(oauthAuthorizationCodes)
		.where(eq(oauthAuthorizationCodes.code, code))
		.limit(1);

	if (!authCode) return null;

	// Verify not expired
	if (authCode.expiresAt < new Date()) {
		await db.delete(oauthAuthorizationCodes).where(eq(oauthAuthorizationCodes.code, code));
		return null;
	}

	// Verify client ID matches
	if (authCode.clientId !== clientId) return null;

	// Verify redirect URI matches
	if (authCode.redirectUri !== redirectUri) return null;

	// Verify PKCE
	if (!verifyPKCE(codeVerifier, authCode.codeChallenge, authCode.codeChallengeMethod)) {
		return null;
	}

	// Delete code (one-time use)
	await db.delete(oauthAuthorizationCodes).where(eq(oauthAuthorizationCodes.code, code));

	return { userId: authCode.userId };
}
```

**Step 2: Commit**

```bash
git add src/lib/server/oauth.ts
git commit -m "feat: add OAuth authorization code flow"
```

---

## Task 5: OAuth Service - Token Management

**Files:**
- Modify: `src/lib/server/oauth.ts`

**Step 1: Add token functions**

Add to `src/lib/server/oauth.ts`:

```typescript
// Create access token
export async function createAccessToken(userId: string, clientId: string): Promise<string> {
	const db = getDB();
	const accessToken = generateToken(48);
	const accessTokenHash = hashToken(accessToken);
	const expiresAt = new Date(Date.now() + ACCESS_TOKEN_LIFETIME_MS);

	await db.insert(oauthTokens).values({
		userId,
		clientId,
		accessTokenHash,
		refreshTokenHash: null,
		expiresAt,
		scopes: ['mcp:access']
	});

	return accessToken;
}

// Validate access token
export async function validateAccessToken(token: string): Promise<{ userId: string; clientId: string } | null> {
	const db = getDB();

	// Get all non-expired tokens
	const tokens = await db
		.select()
		.from(oauthTokens)
		.where(gt(oauthTokens.expiresAt, new Date()));

	// Find matching token by comparing hash
	for (const dbToken of tokens) {
		if (verifyToken(token, dbToken.accessTokenHash)) {
			return { userId: dbToken.userId, clientId: dbToken.clientId };
		}
	}

	return null;
}

// Revoke all tokens for a client
export async function revokeClientTokens(clientId: string): Promise<void> {
	const db = getDB();
	await db.delete(oauthTokens).where(eq(oauthTokens.clientId, clientId));
}

// Clean up expired tokens and codes
export async function cleanupExpiredOAuthData(): Promise<void> {
	const db = getDB();
	const now = new Date();

	await db.delete(oauthTokens).where(lt(oauthTokens.expiresAt, now));
	await db.delete(oauthAuthorizationCodes).where(lt(oauthAuthorizationCodes.expiresAt, now));
}
```

**Step 2: Commit**

```bash
git add src/lib/server/oauth.ts
git commit -m "feat: add OAuth token management"
```

---

## Task 6: OAuth Endpoint - Authorize

**Files:**
- Create: `src/routes/api/oauth/authorize/+server.ts`

**Step 1: Create authorization endpoint**

```typescript
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getOAuthClient,
	hasAuthorization,
	createAuthorization,
	createAuthorizationCode
} from '$lib/server/oauth';

export const GET: RequestHandler = async ({ url, locals, cookies }) => {
	// Extract OAuth parameters
	const clientId = url.searchParams.get('client_id');
	const redirectUri = url.searchParams.get('redirect_uri');
	const state = url.searchParams.get('state');
	const codeChallenge = url.searchParams.get('code_challenge');
	const codeChallengeMethod = url.searchParams.get('code_challenge_method') || 'S256';

	// Validate required parameters
	if (!clientId || !redirectUri || !state || !codeChallenge) {
		throw error(400, 'Missing required OAuth parameters');
	}

	// Validate code challenge method
	if (codeChallengeMethod !== 'S256' && codeChallengeMethod !== 'plain') {
		throw error(400, 'Invalid code_challenge_method');
	}

	// Validate client exists
	const client = await getOAuthClient(clientId);
	if (!client) {
		throw error(400, 'Invalid client_id');
	}

	// Validate redirect URI (must be HTTPS or localhost)
	const uri = new URL(redirectUri);
	const isLocalhost = uri.hostname === 'localhost' || uri.hostname === '127.0.0.1';
	if (uri.protocol !== 'https:' && !isLocalhost) {
		throw error(400, 'redirect_uri must use HTTPS');
	}

	// Require authentication
	if (!locals.user) {
		// Store OAuth params in cookie and redirect to login
		cookies.set('oauth_pending', JSON.stringify({ clientId, redirectUri, state, codeChallenge, codeChallengeMethod }), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: 60 * 10 // 10 minutes
		});
		throw redirect(302, '/api/auth/login');
	}

	// Check if user has already authorized this client
	const authorized = await hasAuthorization(locals.user.id, clientId);

	if (!authorized) {
		// Show consent screen
		// Store params for POST handler
		cookies.set('oauth_consent', JSON.stringify({ clientId, redirectUri, state, codeChallenge, codeChallengeMethod }), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: 60 * 10
		});
		throw redirect(302, `/oauth/consent?client_id=${encodeURIComponent(clientId)}`);
	}

	// Already authorized - create auth code and redirect
	const code = await createAuthorizationCode(
		locals.user.id,
		clientId,
		redirectUri,
		codeChallenge,
		codeChallengeMethod
	);

	const redirectUrl = new URL(redirectUri);
	redirectUrl.searchParams.set('code', code);
	redirectUrl.searchParams.set('state', state);

	throw redirect(302, redirectUrl.toString());
};
```

**Step 2: Commit**

```bash
git add src/routes/api/oauth/authorize/+server.ts
git commit -m "feat: add OAuth authorize endpoint"
```

---

## Task 7: OAuth Endpoint - Token Exchange

**Files:**
- Create: `src/routes/api/oauth/token/+server.ts`

**Step 1: Create token endpoint**

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyOAuthClient, consumeAuthorizationCode, createAccessToken } from '$lib/server/oauth';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.formData();

	const grantType = body.get('grant_type');
	const code = body.get('code');
	const redirectUri = body.get('redirect_uri');
	const clientId = body.get('client_id');
	const clientSecret = body.get('client_secret');
	const codeVerifier = body.get('code_verifier');

	// Validate grant type
	if (grantType !== 'authorization_code') {
		return json({ error: 'unsupported_grant_type' }, { status: 400 });
	}

	// Validate required parameters
	if (!code || !redirectUri || !clientId || !clientSecret || !codeVerifier) {
		return json({ error: 'invalid_request', error_description: 'Missing required parameters' }, { status: 400 });
	}

	// Verify client credentials
	const client = await verifyOAuthClient(
		clientId.toString(),
		clientSecret.toString()
	);

	if (!client) {
		return json({ error: 'invalid_client' }, { status: 401 });
	}

	// Consume authorization code
	const result = await consumeAuthorizationCode(
		code.toString(),
		clientId.toString(),
		redirectUri.toString(),
		codeVerifier.toString()
	);

	if (!result) {
		return json({ error: 'invalid_grant', error_description: 'Invalid authorization code' }, { status: 400 });
	}

	// Create access token
	const accessToken = await createAccessToken(result.userId, clientId.toString());

	return json({
		access_token: accessToken,
		token_type: 'Bearer',
		expires_in: 7 * 24 * 60 * 60, // 7 days in seconds
		scope: 'mcp:access'
	});
};
```

**Step 2: Commit**

```bash
git add src/routes/api/oauth/token/+server.ts
git commit -m "feat: add OAuth token exchange endpoint"
```

---

## Task 8: OAuth Consent Screen

**Files:**
- Create: `src/routes/oauth/consent/+page.svelte`
- Create: `src/routes/oauth/consent/+page.server.ts`

**Step 1: Create consent page server logic**

```typescript
import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getOAuthClient, createAuthorization, createAuthorizationCode } from '$lib/server/oauth';

export const load: PageServerLoad = async ({ url, locals, cookies }) => {
	if (!locals.user) {
		throw redirect(302, '/api/auth/login');
	}

	const clientId = url.searchParams.get('client_id');
	if (!clientId) {
		throw error(400, 'Missing client_id');
	}

	const client = await getOAuthClient(clientId);
	if (!client) {
		throw error(400, 'Invalid client_id');
	}

	return {
		clientId
	};
};

export const actions: Actions = {
	approve: async ({ locals, cookies, url }) => {
		if (!locals.user) {
			throw error(401, 'Not authenticated');
		}

		const consentData = cookies.get('oauth_consent');
		if (!consentData) {
			throw error(400, 'No consent request pending');
		}

		const { clientId, redirectUri, state, codeChallenge, codeChallengeMethod } = JSON.parse(consentData);

		// Create authorization
		await createAuthorization(locals.user.id, clientId);

		// Create auth code
		const code = await createAuthorizationCode(
			locals.user.id,
			clientId,
			redirectUri,
			codeChallenge,
			codeChallengeMethod
		);

		// Clear cookie
		cookies.delete('oauth_consent', { path: '/' });

		// Redirect back to client
		const redirectUrl = new URL(redirectUri);
		redirectUrl.searchParams.set('code', code);
		redirectUrl.searchParams.set('state', state);

		throw redirect(302, redirectUrl.toString());
	},

	deny: async ({ cookies }) => {
		cookies.delete('oauth_consent', { path: '/' });
		throw redirect(302, '/?oauth=denied');
	}
};
```

**Step 2: Create consent page UI**

```svelte
<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '$lib/components/ui/card';

	let { data } = $props();
</script>

<div class="flex min-h-screen items-center justify-center p-4">
	<Card class="w-full max-w-md">
		<CardHeader>
			<CardTitle>Authorize MCP Access</CardTitle>
			<CardDescription>
				An application wants to access your furniture projects
			</CardDescription>
		</CardHeader>
		<CardContent class="space-y-4">
			<div class="rounded-lg bg-muted p-4">
				<p class="text-sm font-medium">This application will be able to:</p>
				<ul class="mt-2 space-y-1 text-sm text-muted-foreground">
					<li>• View your projects</li>
					<li>• Add furniture items to your projects</li>
				</ul>
			</div>
		</CardContent>
		<CardFooter class="flex gap-2">
			<form method="POST" action="?/deny" class="flex-1">
				<Button type="submit" variant="outline" class="w-full">Deny</Button>
			</form>
			<form method="POST" action="?/approve" class="flex-1">
				<Button type="submit" class="w-full">Approve</Button>
			</form>
		</CardFooter>
	</Card>
</div>
```

**Step 3: Commit**

```bash
git add src/routes/oauth/consent/
git commit -m "feat: add OAuth consent screen"
```

---

## Task 9: MCP Server - Setup and Tools

**Files:**
- Create: `src/routes/api/mcp/+server.ts`

**Step 1: Create MCP server endpoint**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'crypto';
import { validateAccessToken } from '$lib/server/oauth';
import { getUserProjects } from '$lib/server/projects';
import { getProjectRole, createItem } from '$lib/server/items';
import type { RequestHandler } from './$types';
import * as z from 'zod';

// Session storage
const transports: Record<string, StreamableHTTPServerTransport> = {};

async function createMcpServer(userId: string) {
	const server = new McpServer({
		name: 'wohnungs-plan',
		version: '1.0.0'
	});

	// Register list_projects tool
	server.registerTool(
		'list_projects',
		{
			title: 'List Projects',
			description: 'Get all projects the user has access to',
			inputSchema: {},
			outputSchema: {
				projects: z.array(
					z.object({
						id: z.string(),
						name: z.string(),
						role: z.enum(['owner', 'editor', 'viewer'])
					})
				)
			}
		},
		async () => {
			const projects = await getUserProjects(userId);
			const projectList = projects.map((p) => ({
				id: p.id,
				name: p.name,
				role: p.role as 'owner' | 'editor' | 'viewer'
			}));

			return {
				content: [{ type: 'text', text: JSON.stringify({ projects: projectList }) }],
				structuredContent: { projects: projectList }
			};
		}
	);

	// Register add_furniture_item tool
	server.registerTool(
		'add_furniture_item',
		{
			title: 'Add Furniture Item',
			description: 'Add a new furniture item to a project (not placed on canvas)',
			inputSchema: {
				projectId: z.string().describe('Project ID to add item to'),
				name: z.string().describe('Item name'),
				width: z.number().positive().describe('Width in cm'),
				height: z.number().positive().describe('Height in cm'),
				price: z.number().positive().optional().describe('Price'),
				priceCurrency: z.string().default('EUR').optional(),
				productUrl: z.string().url().optional().describe('Product URL')
			},
			outputSchema: {
				item: z.object({
					id: z.string(),
					name: z.string(),
					width: z.number(),
					height: z.number()
				})
			}
		},
		async ({ projectId, name, width, height, price, priceCurrency, productUrl }) => {
			// Verify user has edit access
			const role = await getProjectRole(projectId, userId);
			if (!role || role === 'viewer') {
				throw new Error('Edit access required');
			}

			// Create item (not placed on canvas)
			const item = await createItem(projectId, {
				name,
				width,
				height,
				x: null,
				y: null,
				rotation: 0,
				color: '#3b82f6',
				price: price ?? null,
				priceCurrency: priceCurrency ?? 'EUR',
				productUrl: productUrl ?? null,
				shape: 'rectangle',
				cutoutWidth: null,
				cutoutHeight: null,
				cutoutCorner: null
			});

			return {
				content: [{ type: 'text', text: `Added ${name} to project` }],
				structuredContent: {
					item: {
						id: item.id,
						name: item.name,
						width: item.width,
						height: item.height
					}
				}
			};
		}
	);

	return server;
}

export const POST: RequestHandler = async ({ request }) => {
	// Authenticate via Bearer token
	const authHeader = request.headers.get('authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
			status: 401,
			headers: { 'WWW-Authenticate': 'Bearer' }
		});
	}

	const token = authHeader.replace('Bearer ', '');
	const validation = await validateAccessToken(token);

	if (!validation) {
		return new Response(JSON.stringify({ error: 'Invalid token' }), {
			status: 401,
			headers: { 'WWW-Authenticate': 'Bearer' }
		});
	}

	const sessionId = request.headers.get('mcp-session-id') as string | undefined;
	const body = await request.json();

	let transport: StreamableHTTPServerTransport;

	if (sessionId && transports[sessionId]) {
		// Reuse existing session
		transport = transports[sessionId];
	} else if (!sessionId && isInitializeRequest(body)) {
		// New session
		transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: () => randomUUID(),
			onsessioninitialized: (id) => {
				transports[id] = transport;
			},
			onsessionclosed: (id) => {
				delete transports[id];
			}
		});

		transport.onclose = () => {
			if (transport.sessionId) {
				delete transports[transport.sessionId];
			}
		};

		const server = await createMcpServer(validation.userId);
		await server.connect(transport);
	} else {
		return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 400 });
	}

	// Let transport handle the request
	const response = new Response();
	await transport.handleRequest(request, response, body);
	return response;
};

export const GET: RequestHandler = async ({ request }) => {
	const sessionId = request.headers.get('mcp-session-id') as string;
	const transport = transports[sessionId];

	if (!transport) {
		return new Response('Invalid session', { status: 400 });
	}

	const response = new Response();
	await transport.handleRequest(request, response);
	return response;
};

export const DELETE: RequestHandler = async ({ request }) => {
	const sessionId = request.headers.get('mcp-session-id') as string;
	const transport = transports[sessionId];

	if (!transport) {
		return new Response('Invalid session', { status: 400 });
	}

	const response = new Response();
	await transport.handleRequest(request, response);
	return response;
};
```

**Step 2: Install zod if not present**

Run: `bun add zod`
Expected: zod installed

**Step 3: Commit**

```bash
git add src/routes/api/mcp/+server.ts package.json bun.lockb
git commit -m "feat: add MCP server endpoint with tools"
```

---

## Task 10: Settings UI - MCP Credentials Page

**Files:**
- Create: `src/routes/settings/mcp/+page.svelte`
- Create: `src/routes/settings/mcp/+page.server.ts`

**Step 1: Create settings server logic**

```typescript
import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getOrCreateOAuthClient, regenerateClientSecret } from '$lib/server/oauth';
import { config } from '$lib/server/env';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const { client, secret } = await getOrCreateOAuthClient(locals.user.id);

	// Determine server URL (from env or request)
	const serverUrl = config.publicUrl || url.origin;

	return {
		clientId: client.clientId,
		clientSecret: secret,
		serverUrl: `${serverUrl}/api/mcp`
	};
};

export const actions: Actions = {
	regenerate: async ({ locals }) => {
		if (!locals.user) {
			throw error(401, 'Authentication required');
		}

		const newSecret = await regenerateClientSecret(locals.user.id);

		return {
			success: true,
			clientSecret: newSecret
		};
	}
};
```

**Step 2: Add publicUrl to env config**

Modify `src/lib/server/env.ts` - add to config object:

```typescript
publicUrl: process.env.PUBLIC_URL || ''
```

**Step 3: Create settings page UI**

```svelte
<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Copy, RefreshCw } from 'lucide-svelte';
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let showSecret = $state(!!data.clientSecret || !!form?.clientSecret);
	let copiedField = $state<string | null>(null);

	const displaySecret = $derived(form?.clientSecret || data.clientSecret);

	function copyToClipboard(text: string, field: string) {
		navigator.clipboard.writeText(text);
		copiedField = field;
		setTimeout(() => (copiedField = null), 2000);
	}
</script>

<div class="container max-w-4xl py-8">
	<div class="mb-6">
		<h1 class="text-3xl font-bold">MCP Integration</h1>
		<p class="text-muted-foreground mt-2">
			Configure AI assistants to add furniture items to your projects
		</p>
	</div>

	<div class="space-y-6">
		<!-- Credentials -->
		<Card>
			<CardHeader>
				<CardTitle>OAuth Credentials</CardTitle>
				<CardDescription>
					Use these credentials to configure your AI assistant (e.g., claude.ai connector)
				</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				<!-- Server URL -->
				<div class="space-y-2">
					<Label for="server-url">Server URL</Label>
					<div class="flex gap-2">
						<Input id="server-url" value={data.serverUrl} readonly class="font-mono text-sm" />
						<Button
							type="button"
							variant="outline"
							size="icon"
							onclick={() => copyToClipboard(data.serverUrl, 'url')}
						>
							{#if copiedField === 'url'}
								✓
							{:else}
								<Copy class="h-4 w-4" />
							{/if}
						</Button>
					</div>
				</div>

				<!-- Client ID -->
				<div class="space-y-2">
					<Label for="client-id">OAuth Client ID</Label>
					<div class="flex gap-2">
						<Input id="client-id" value={data.clientId} readonly class="font-mono text-sm" />
						<Button
							type="button"
							variant="outline"
							size="icon"
							onclick={() => copyToClipboard(data.clientId, 'id')}
						>
							{#if copiedField === 'id'}
								✓
							{:else}
								<Copy class="h-4 w-4" />
							{/if}
						</Button>
					</div>
				</div>

				<!-- Client Secret -->
				<div class="space-y-2">
					<Label for="client-secret">OAuth Client Secret</Label>
					{#if showSecret && displaySecret}
						<div class="flex gap-2">
							<Input
								id="client-secret"
								value={displaySecret}
								readonly
								class="font-mono text-sm"
							/>
							<Button
								type="button"
								variant="outline"
								size="icon"
								onclick={() => copyToClipboard(displaySecret, 'secret')}
							>
								{#if copiedField === 'secret'}
									✓
								{:else}
									<Copy class="h-4 w-4" />
								{/if}
							</Button>
						</div>
					{:else}
						<p class="text-sm text-muted-foreground">
							Secret is hidden. Click "Regenerate Secret" to create a new one.
						</p>
					{/if}
				</div>
			</CardContent>
			<CardFooter>
				<form method="POST" action="?/regenerate" use:enhance>
					<Button type="submit" variant="outline">
						<RefreshCw class="mr-2 h-4 w-4" />
						Regenerate Secret
					</Button>
				</form>
			</CardFooter>
		</Card>

		<!-- Setup Instructions -->
		<Card>
			<CardHeader>
				<CardTitle>Setup Instructions</CardTitle>
				<CardDescription>How to configure claude.ai connector</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				<ol class="list-decimal list-inside space-y-2 text-sm">
					<li>Go to <a href="https://claude.ai" target="_blank" class="text-primary hover:underline">claude.ai</a> → Settings → Connectors</li>
					<li>Click "Add custom connector"</li>
					<li>Enter the Server URL from above</li>
					<li>Click "Advanced settings"</li>
					<li>Enter your OAuth Client ID and Client Secret</li>
					<li>Click "Add"</li>
					<li>You'll be redirected to authorize access - click "Approve"</li>
					<li>Start chatting! Try: "What projects do I have?" or "Add a 200x90cm desk to my Living Room project"</li>
				</ol>
			</CardContent>
		</Card>
	</div>
</div>
```

**Step 4: Commit**

```bash
git add src/routes/settings/mcp/ src/lib/server/env.ts
git commit -m "feat: add MCP settings UI for credentials"
```

---

## Task 11: Navigation - Add Settings Link

**Files:**
- Modify: Main navigation component (find with Glob)

**Step 1: Find navigation component**

Run: `find src -name "*nav*" -o -name "*header*" -o -name "*layout*" | grep -E '\.(svelte|ts)$'`
Expected: List of navigation-related files

**Step 2: Add link to MCP settings**

Add a link to `/settings/mcp` in the appropriate navigation component. This will vary based on your app structure.

If there's a settings page, add "MCP Integration" as a tab or link.

**Step 3: Commit**

```bash
git add <navigation-file>
git commit -m "feat: add navigation link to MCP settings"
```

---

## Task 12: Handle OAuth Login Redirect

**Files:**
- Modify: `src/routes/api/auth/callback/+server.ts`

**Step 1: Add OAuth pending check after login**

Add after successful session creation (around line 47):

```typescript
// Check for pending OAuth flow
const oauthPending = cookies.get('oauth_pending');
if (oauthPending) {
	cookies.delete('oauth_pending', { path: '/' });
	const { clientId, redirectUri, state, codeChallenge, codeChallengeMethod } = JSON.parse(oauthPending);

	// Redirect back to OAuth authorize endpoint
	const authorizeUrl = new URL('/api/oauth/authorize', url.origin);
	authorizeUrl.searchParams.set('client_id', clientId);
	authorizeUrl.searchParams.set('redirect_uri', redirectUri);
	authorizeUrl.searchParams.set('state', state);
	authorizeUrl.searchParams.set('code_challenge', codeChallenge);
	authorizeUrl.searchParams.set('code_challenge_method', codeChallengeMethod);

	throw redirect(302, authorizeUrl.toString());
}
```

**Step 2: Commit**

```bash
git add src/routes/api/auth/callback/+server.ts
git commit -m "feat: handle OAuth flow after login redirect"
```

---

## Task 13: Environment Variable Documentation

**Files:**
- Modify: `.env.example` (or create if doesn't exist)

**Step 1: Add PUBLIC_URL to env example**

```bash
# Public URL for OAuth redirects (optional, defaults to request origin)
PUBLIC_URL=https://wohnungs-plan.app
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add PUBLIC_URL environment variable"
```

---

## Task 14: Manual Testing - OAuth Flow

**No files modified - this is a manual testing step**

**Step 1: Start dev server**

Run: `bun dev`
Expected: Server starts on http://localhost:5173

**Step 2: Visit MCP settings**

Navigate to: http://localhost:5173/settings/mcp
Expected: See OAuth credentials displayed

**Step 3: Copy credentials**

Copy Client ID, Client Secret, and Server URL
Expected: All fields can be copied

**Step 4: Test regenerate secret**

Click "Regenerate Secret" button
Expected: New secret displayed, can copy it

---

## Task 15: Manual Testing - MCP Tools

**No files modified - requires MCP client for testing**

**Step 1: Set up MCP test client (optional)**

You can use the MCP Inspector or write a simple test script using `@modelcontextprotocol/sdk/client`

**Step 2: Test OAuth authorization flow**

1. Start authorization request to `/api/oauth/authorize`
2. Complete login if needed
3. Approve on consent screen
4. Exchange code for token at `/api/oauth/token`

Expected: Receive access token

**Step 3: Test list_projects tool**

Call MCP endpoint with Bearer token, invoke `list_projects` tool
Expected: Returns user's projects

**Step 4: Test add_furniture_item tool**

Call `add_furniture_item` with valid project ID and item data
Expected: Item created in database with x/y = null

---

## Task 16: Final Commit and Documentation

**Files:**
- Create: `docs/mcp-integration.md`

**Step 1: Create user documentation**

```markdown
# MCP Integration Guide

## Overview

The wohnungs-plan MCP server allows AI assistants (like claude.ai) to add furniture items to your projects.

## Setup

### 1. Get Your Credentials

1. Log in to wohnungs-plan
2. Go to Settings → MCP Integration
3. Copy your OAuth Client ID and Client Secret
4. Copy the Server URL

### 2. Configure claude.ai

1. Open claude.ai
2. Go to Settings → Connectors
3. Click "Add custom connector"
4. Enter the Server URL
5. Click "Advanced settings"
6. Enter your OAuth Client ID and Secret
7. Click "Add"
8. You'll be redirected to authorize - click "Approve"

### 3. Start Using

Chat with Claude:

- "What projects do I have?"
- "Add a 200x90cm IKEA Malm desk to my Living Room project, it costs €179"

Items added by AI appear as "unplaced" in your project - drag them onto the canvas to position them.

## Available Tools

### list_projects

Get all projects you have access to.

### add_furniture_item

Add a furniture item to a project (not yet placed on canvas).

**Parameters:**
- `projectId` (required): Project ID
- `name` (required): Item name
- `width` (required): Width in cm
- `height` (required): Height in cm
- `price` (optional): Price
- `priceCurrency` (optional): Currency code (default: EUR)
- `productUrl` (optional): Link to product page

## Security

- OAuth Client Secrets are hashed and stored securely
- Access tokens expire after 7 days
- You can regenerate your secret at any time (this will invalidate all existing tokens)
- Only you can access your projects via MCP

## Troubleshooting

**Q: I regenerated my secret, now claude.ai can't connect**

A: Update your claude.ai connector with the new secret (Settings → Connectors → Edit)

**Q: Items aren't appearing in my project**

A: Check that the AI specified the correct project ID. Use "list_projects" first to see available projects.

**Q: I get "Access denied" errors**

A: You need editor or owner role on a project to add items. Viewer role is read-only.
```

**Step 2: Commit documentation**

```bash
git add docs/mcp-integration.md
git commit -m "docs: add MCP integration user guide"
```

---

## Completion Checklist

- [ ] Dependencies installed (@modelcontextprotocol/sdk, bcrypt, zod)
- [ ] Database schema created (4 OAuth tables)
- [ ] OAuth service implemented (client, authorization, token management)
- [ ] OAuth endpoints created (/authorize, /token)
- [ ] OAuth consent screen built
- [ ] MCP server endpoint created (/api/mcp)
- [ ] MCP tools registered (list_projects, add_furniture_item)
- [ ] Settings UI built (/settings/mcp)
- [ ] Navigation updated
- [ ] OAuth login redirect handled
- [ ] Environment variables documented
- [ ] Manual testing completed
- [ ] User documentation written

## Notes

- PKCE (S256) is enforced for security
- All secrets and tokens are hashed before storage
- Access tokens expire after 7 days
- Authorization codes expire after 10 minutes
- Redirect URIs must be HTTPS (except localhost)
- Items created via MCP have x/y = null (unplaced)
