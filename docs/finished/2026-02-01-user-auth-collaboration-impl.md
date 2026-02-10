# User Authentication & Collaboration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Infomaniak OpenID Connect authentication, PostgreSQL backend, and real-time collaboration to the Floorplanner app while preserving offline-first IndexedDB functionality.

**Architecture:** Dual-storage system where IndexedDB remains primary for anonymous users, PostgreSQL becomes primary when logged in. WebSocket-based real-time collaboration with item-level locking and presence indicators.

**Tech Stack:** SvelteKit API routes, Bun native PostgreSQL driver, Infomaniak OIDC, WebSockets, Svelte 5 stores

---

## Phase 1: Database & Server Setup

### Task 1.1: Add Environment Configuration

**Files:**
- Create: `src/lib/server/env.ts`
- Create: `.env.example`
- Modify: `.gitignore`

**Step 1: Create .env.example template**

```bash
# .env.example
# Infomaniak OIDC
INFOMANIAK_CLIENT_ID=
INFOMANIAK_CLIENT_SECRET=
INFOMANIAK_REDIRECT_URI=http://localhost:5173/api/auth/callback

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/floorplanner

# Session
SESSION_SECRET=generate-a-random-32-byte-string

# Uploads
UPLOAD_DIR=./uploads
MAX_IMAGE_SIZE_BYTES=5242880

# App
PUBLIC_APP_URL=http://localhost:5173
```

**Step 2: Add .env to .gitignore**

Append to `.gitignore`:
```
.env
.env.local
uploads/
```

**Step 3: Create server-side env loader**

```typescript
// src/lib/server/env.ts
import { env } from '$env/dynamic/private';

export const config = {
	infomaniak: {
		clientId: env.INFOMANIAK_CLIENT_ID ?? '',
		clientSecret: env.INFOMANIAK_CLIENT_SECRET ?? '',
		redirectUri: env.INFOMANIAK_REDIRECT_URI ?? 'http://localhost:5173/api/auth/callback',
		authorizationEndpoint: 'https://login.infomaniak.com/authorize',
		tokenEndpoint: 'https://login.infomaniak.com/token',
		userinfoEndpoint: 'https://login.infomaniak.com/oauth2/userinfo'
	},
	database: {
		url: env.DATABASE_URL ?? ''
	},
	session: {
		secret: env.SESSION_SECRET ?? 'dev-secret-change-in-production'
	},
	uploads: {
		dir: env.UPLOAD_DIR ?? './uploads',
		maxImageSize: parseInt(env.MAX_IMAGE_SIZE_BYTES ?? '5242880', 10)
	}
};
```

**Step 4: Commit**

```bash
git add .env.example .gitignore src/lib/server/env.ts
git commit -m "feat: add environment configuration for auth and database"
```

---

### Task 1.2: Set Up PostgreSQL Connection

**Files:**
- Create: `src/lib/server/db.ts`
- Create: `src/lib/server/schema.sql`

**Step 1: Create database schema file**

```sql
-- src/lib/server/schema.sql

-- Users (from Infomaniak OIDC)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    infomaniak_sub TEXT UNIQUE NOT NULL,
    email TEXT,
    name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EUR',
    grid_size INTEGER NOT NULL DEFAULT 20,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Floorplans
CREATE TABLE IF NOT EXISTS floorplans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_name TEXT,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    scale FLOAT,
    reference_length FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Items (furniture)
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    width FLOAT NOT NULL,
    height FLOAT NOT NULL,
    x FLOAT,
    y FLOAT,
    rotation FLOAT DEFAULT 0,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    price FLOAT,
    price_currency TEXT DEFAULT 'EUR',
    product_url TEXT,
    shape TEXT NOT NULL DEFAULT 'rectangle',
    cutout_width FLOAT,
    cutout_height FLOAT,
    cutout_corner TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project members (sharing)
CREATE TABLE IF NOT EXISTS project_members (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

-- Project invites
CREATE TABLE IF NOT EXISTS project_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_floorplans_project_id ON floorplans(project_id);
CREATE INDEX IF NOT EXISTS idx_items_project_id ON items(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_invites_token ON project_invites(token);
CREATE INDEX IF NOT EXISTS idx_project_invites_email ON project_invites(email);
```

**Step 2: Create database connection module**

```typescript
// src/lib/server/db.ts
import { SQL } from 'bun';
import { config } from './env';

let db: SQL | null = null;

export function getDB(): SQL {
	if (!db) {
		if (!config.database.url) {
			throw new Error('DATABASE_URL environment variable is not set');
		}
		db = new SQL(config.database.url);
	}
	return db;
}

export async function closeDB(): Promise<void> {
	if (db) {
		await db.close();
		db = null;
	}
}
```

**Step 3: Commit**

```bash
git add src/lib/server/db.ts src/lib/server/schema.sql
git commit -m "feat: add PostgreSQL connection and schema"
```

---

### Task 1.3: Create Server Types

**Files:**
- Create: `src/lib/server/types.ts`

**Step 1: Create server-side type definitions**

```typescript
// src/lib/server/types.ts

export interface DBUser {
	id: string;
	infomaniak_sub: string;
	email: string | null;
	name: string | null;
	avatar_url: string | null;
	created_at: Date;
	updated_at: Date;
}

export interface DBSession {
	id: string;
	user_id: string;
	refresh_token: string | null;
	expires_at: Date;
	created_at: Date;
}

export interface DBProject {
	id: string;
	owner_id: string;
	name: string;
	currency: string;
	grid_size: number;
	created_at: Date;
	updated_at: Date;
}

export interface DBFloorplan {
	id: string;
	project_id: string;
	filename: string;
	original_name: string | null;
	mime_type: string;
	size_bytes: number;
	scale: number | null;
	reference_length: number | null;
	created_at: Date;
	updated_at: Date;
}

export interface DBItem {
	id: string;
	project_id: string;
	name: string;
	width: number;
	height: number;
	x: number | null;
	y: number | null;
	rotation: number;
	color: string;
	price: number | null;
	price_currency: string;
	product_url: string | null;
	shape: string;
	cutout_width: number | null;
	cutout_height: number | null;
	cutout_corner: string | null;
	created_at: Date;
	updated_at: Date;
}

export interface DBProjectMember {
	project_id: string;
	user_id: string;
	role: 'owner' | 'editor' | 'viewer';
	invited_at: Date;
}

export interface DBProjectInvite {
	id: string;
	project_id: string;
	email: string;
	role: 'editor' | 'viewer';
	token: string;
	expires_at: Date;
	accepted_at: Date | null;
	created_at: Date;
}

// API response types
export interface UserProfile {
	id: string;
	email: string | null;
	name: string | null;
	avatarUrl: string | null;
}

export interface ProjectWithRole extends DBProject {
	role: 'owner' | 'editor' | 'viewer';
}

export type ProjectRole = 'owner' | 'editor' | 'viewer';
```

**Step 2: Commit**

```bash
git add src/lib/server/types.ts
git commit -m "feat: add server-side type definitions"
```

---

## Phase 2: Authentication

### Task 2.1: Create Session Management

**Files:**
- Create: `src/lib/server/session.ts`

**Step 1: Create session utilities**

```typescript
// src/lib/server/session.ts
import { getDB } from './db';
import { config } from './env';
import type { DBSession, DBUser } from './types';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function generateSessionId(): string {
	return crypto.randomUUID();
}

export async function createSession(
	userId: string,
	refreshToken?: string
): Promise<DBSession> {
	const db = getDB();
	const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

	const [session] = await db`
		INSERT INTO sessions (user_id, refresh_token, expires_at)
		VALUES (${userId}, ${refreshToken ?? null}, ${expiresAt})
		RETURNING *
	`;

	return session as DBSession;
}

export async function getSession(sessionId: string): Promise<DBSession | null> {
	const db = getDB();
	const [session] = await db`
		SELECT * FROM sessions
		WHERE id = ${sessionId} AND expires_at > NOW()
	`;

	return (session as DBSession) ?? null;
}

export async function getSessionWithUser(
	sessionId: string
): Promise<{ session: DBSession; user: DBUser } | null> {
	const db = getDB();
	const [result] = await db`
		SELECT
			s.id as session_id,
			s.user_id,
			s.refresh_token,
			s.expires_at as session_expires_at,
			s.created_at as session_created_at,
			u.id as user_id,
			u.infomaniak_sub,
			u.email,
			u.name,
			u.avatar_url,
			u.created_at as user_created_at,
			u.updated_at as user_updated_at
		FROM sessions s
		JOIN users u ON s.user_id = u.id
		WHERE s.id = ${sessionId} AND s.expires_at > NOW()
	`;

	if (!result) return null;

	return {
		session: {
			id: result.session_id,
			user_id: result.user_id,
			refresh_token: result.refresh_token,
			expires_at: result.session_expires_at,
			created_at: result.session_created_at
		},
		user: {
			id: result.user_id,
			infomaniak_sub: result.infomaniak_sub,
			email: result.email,
			name: result.name,
			avatar_url: result.avatar_url,
			created_at: result.user_created_at,
			updated_at: result.user_updated_at
		}
	};
}

export async function deleteSession(sessionId: string): Promise<void> {
	const db = getDB();
	await db`DELETE FROM sessions WHERE id = ${sessionId}`;
}

export async function deleteUserSessions(userId: string): Promise<void> {
	const db = getDB();
	await db`DELETE FROM sessions WHERE user_id = ${userId}`;
}

export async function cleanExpiredSessions(): Promise<void> {
	const db = getDB();
	await db`DELETE FROM sessions WHERE expires_at < NOW()`;
}

export function createSessionCookie(sessionId: string): string {
	const secure = config.infomaniak.redirectUri.startsWith('https');
	return [
		`session=${sessionId}`,
		'Path=/',
		'HttpOnly',
		'SameSite=Lax',
		secure ? 'Secure' : '',
		`Max-Age=${SESSION_DURATION_MS / 1000}`
	]
		.filter(Boolean)
		.join('; ');
}

export function clearSessionCookie(): string {
	return 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
}

export function parseSessionCookie(cookieHeader: string | null): string | null {
	if (!cookieHeader) return null;
	const match = cookieHeader.match(/session=([^;]+)/);
	return match ? match[1] : null;
}
```

**Step 2: Commit**

```bash
git add src/lib/server/session.ts
git commit -m "feat: add session management utilities"
```

---

### Task 2.2: Create User Management

**Files:**
- Create: `src/lib/server/users.ts`

**Step 1: Create user CRUD operations**

```typescript
// src/lib/server/users.ts
import { getDB } from './db';
import type { DBUser, UserProfile } from './types';

export async function findUserByInfomaniakSub(sub: string): Promise<DBUser | null> {
	const db = getDB();
	const [user] = await db`
		SELECT * FROM users WHERE infomaniak_sub = ${sub}
	`;
	return (user as DBUser) ?? null;
}

export async function findUserById(id: string): Promise<DBUser | null> {
	const db = getDB();
	const [user] = await db`
		SELECT * FROM users WHERE id = ${id}
	`;
	return (user as DBUser) ?? null;
}

export async function findUserByEmail(email: string): Promise<DBUser | null> {
	const db = getDB();
	const [user] = await db`
		SELECT * FROM users WHERE email = ${email}
	`;
	return (user as DBUser) ?? null;
}

export async function createUser(data: {
	infomaniakSub: string;
	email?: string;
	name?: string;
	avatarUrl?: string;
}): Promise<DBUser> {
	const db = getDB();
	const [user] = await db`
		INSERT INTO users (infomaniak_sub, email, name, avatar_url)
		VALUES (${data.infomaniakSub}, ${data.email ?? null}, ${data.name ?? null}, ${data.avatarUrl ?? null})
		RETURNING *
	`;
	return user as DBUser;
}

export async function updateUser(
	id: string,
	data: { email?: string; name?: string; avatarUrl?: string }
): Promise<DBUser> {
	const db = getDB();
	const [user] = await db`
		UPDATE users SET
			email = COALESCE(${data.email ?? null}, email),
			name = COALESCE(${data.name ?? null}, name),
			avatar_url = COALESCE(${data.avatarUrl ?? null}, avatar_url),
			updated_at = NOW()
		WHERE id = ${id}
		RETURNING *
	`;
	return user as DBUser;
}

export async function upsertUser(data: {
	infomaniakSub: string;
	email?: string;
	name?: string;
	avatarUrl?: string;
}): Promise<DBUser> {
	const db = getDB();
	const [user] = await db`
		INSERT INTO users (infomaniak_sub, email, name, avatar_url)
		VALUES (${data.infomaniakSub}, ${data.email ?? null}, ${data.name ?? null}, ${data.avatarUrl ?? null})
		ON CONFLICT (infomaniak_sub) DO UPDATE SET
			email = COALESCE(EXCLUDED.email, users.email),
			name = COALESCE(EXCLUDED.name, users.name),
			avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
			updated_at = NOW()
		RETURNING *
	`;
	return user as DBUser;
}

export function toUserProfile(user: DBUser): UserProfile {
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		avatarUrl: user.avatar_url
	};
}
```

**Step 2: Commit**

```bash
git add src/lib/server/users.ts
git commit -m "feat: add user management functions"
```

---

### Task 2.3: Create OIDC Client

**Files:**
- Create: `src/lib/server/oidc.ts`

**Step 1: Create Infomaniak OIDC client**

```typescript
// src/lib/server/oidc.ts
import { config } from './env';

export interface OIDCTokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token?: string;
	id_token?: string;
}

export interface OIDCUserInfo {
	sub: string;
	email?: string;
	name?: string;
	picture?: string;
}

export function getAuthorizationUrl(state: string): string {
	const params = new URLSearchParams({
		client_id: config.infomaniak.clientId,
		redirect_uri: config.infomaniak.redirectUri,
		response_type: 'code',
		scope: 'openid profile email',
		state
	});

	return `${config.infomaniak.authorizationEndpoint}?${params}`;
}

export async function exchangeCodeForTokens(code: string): Promise<OIDCTokenResponse> {
	const response = await fetch(config.infomaniak.tokenEndpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			client_id: config.infomaniak.clientId,
			client_secret: config.infomaniak.clientSecret,
			redirect_uri: config.infomaniak.redirectUri,
			code
		})
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Token exchange failed: ${error}`);
	}

	return response.json();
}

export async function getUserInfo(accessToken: string): Promise<OIDCUserInfo> {
	const response = await fetch(config.infomaniak.userinfoEndpoint, {
		headers: {
			Authorization: `Bearer ${accessToken}`
		}
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Userinfo request failed: ${error}`);
	}

	return response.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<OIDCTokenResponse> {
	const response = await fetch(config.infomaniak.tokenEndpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			client_id: config.infomaniak.clientId,
			client_secret: config.infomaniak.clientSecret,
			refresh_token: refreshToken
		})
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Token refresh failed: ${error}`);
	}

	return response.json();
}
```

**Step 2: Commit**

```bash
git add src/lib/server/oidc.ts
git commit -m "feat: add Infomaniak OIDC client"
```

---

### Task 2.4: Create Auth API Endpoints

**Files:**
- Create: `src/routes/api/auth/login/+server.ts`
- Create: `src/routes/api/auth/callback/+server.ts`
- Create: `src/routes/api/auth/logout/+server.ts`
- Create: `src/routes/api/auth/me/+server.ts`

**Step 1: Create login endpoint (redirect to Infomaniak)**

```typescript
// src/routes/api/auth/login/+server.ts
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthorizationUrl } from '$lib/server/oidc';

export const GET: RequestHandler = async ({ cookies }) => {
	// Generate and store state for CSRF protection
	const state = crypto.randomUUID();
	cookies.set('oauth_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 10 // 10 minutes
	});

	const authUrl = getAuthorizationUrl(state);
	throw redirect(302, authUrl);
};
```

**Step 2: Create callback endpoint (handle OIDC redirect)**

```typescript
// src/routes/api/auth/callback/+server.ts
import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exchangeCodeForTokens, getUserInfo } from '$lib/server/oidc';
import { upsertUser } from '$lib/server/users';
import { createSession, createSessionCookie } from '$lib/server/session';

export const GET: RequestHandler = async ({ url, cookies }) => {
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
		const cookie = createSessionCookie(session.id);

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
```

**Step 3: Create logout endpoint**

```typescript
// src/routes/api/auth/logout/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteSession, parseSessionCookie, clearSessionCookie } from '$lib/server/session';

export const POST: RequestHandler = async ({ request }) => {
	const sessionId = parseSessionCookie(request.headers.get('cookie'));

	if (sessionId) {
		await deleteSession(sessionId);
	}

	return new Response(JSON.stringify({ success: true }), {
		headers: {
			'Content-Type': 'application/json',
			'Set-Cookie': clearSessionCookie()
		}
	});
};
```

**Step 4: Create me endpoint (get current user)**

```typescript
// src/routes/api/auth/me/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionWithUser, parseSessionCookie } from '$lib/server/session';
import { toUserProfile } from '$lib/server/users';

export const GET: RequestHandler = async ({ request }) => {
	const sessionId = parseSessionCookie(request.headers.get('cookie'));

	if (!sessionId) {
		return json({ user: null });
	}

	const result = await getSessionWithUser(sessionId);

	if (!result) {
		return json({ user: null });
	}

	return json({ user: toUserProfile(result.user) });
};
```

**Step 5: Commit**

```bash
git add src/routes/api/auth/
git commit -m "feat: add auth API endpoints (login, callback, logout, me)"
```

---

### Task 2.5: Create Server Hooks for Auth Middleware

**Files:**
- Create: `src/hooks.server.ts`
- Modify: `src/app.d.ts`

**Step 1: Update app.d.ts with locals types**

```typescript
// src/app.d.ts
import type { DBUser } from '$lib/server/types';

declare global {
	namespace App {
		interface Locals {
			user: DBUser | null;
			sessionId: string | null;
		}
	}
}

export {};
```

**Step 2: Create server hooks**

```typescript
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { getSessionWithUser, parseSessionCookie } from '$lib/server/session';

export const handle: Handle = async ({ event, resolve }) => {
	// Parse session from cookie
	const sessionId = parseSessionCookie(event.request.headers.get('cookie'));

	if (sessionId) {
		const result = await getSessionWithUser(sessionId);
		if (result) {
			event.locals.user = result.user;
			event.locals.sessionId = sessionId;
		} else {
			event.locals.user = null;
			event.locals.sessionId = null;
		}
	} else {
		event.locals.user = null;
		event.locals.sessionId = null;
	}

	return resolve(event);
};
```

**Step 3: Commit**

```bash
git add src/hooks.server.ts src/app.d.ts
git commit -m "feat: add auth middleware via server hooks"
```

---

## Phase 3: Frontend Auth Integration

### Task 3.1: Create Auth Store

**Files:**
- Create: `src/lib/stores/auth.svelte.ts`

**Step 1: Create auth store with Svelte 5 patterns**

```typescript
// src/lib/stores/auth.svelte.ts
import type { UserProfile } from '$lib/server/types';

interface AuthState {
	user: UserProfile | null;
	isLoading: boolean;
	isAuthenticated: boolean;
}

let state = $state<AuthState>({
	user: null,
	isLoading: true,
	isAuthenticated: false
});

export function getAuthState(): AuthState {
	return state;
}

export function getUser(): UserProfile | null {
	return state.user;
}

export function isAuthenticated(): boolean {
	return state.isAuthenticated;
}

export function isLoading(): boolean {
	return state.isLoading;
}

export async function fetchUser(): Promise<void> {
	state.isLoading = true;
	try {
		const response = await fetch('/api/auth/me');
		const data = await response.json();
		state.user = data.user;
		state.isAuthenticated = !!data.user;
	} catch (error) {
		console.error('Failed to fetch user:', error);
		state.user = null;
		state.isAuthenticated = false;
	} finally {
		state.isLoading = false;
	}
}

export function login(): void {
	window.location.href = '/api/auth/login';
}

export async function logout(): Promise<void> {
	try {
		await fetch('/api/auth/logout', { method: 'POST' });
		state.user = null;
		state.isAuthenticated = false;
	} catch (error) {
		console.error('Logout failed:', error);
	}
}

export function setUser(user: UserProfile | null): void {
	state.user = user;
	state.isAuthenticated = !!user;
	state.isLoading = false;
}
```

**Step 2: Commit**

```bash
git add src/lib/stores/auth.svelte.ts
git commit -m "feat: add auth store for frontend state"
```

---

### Task 3.2: Create Login Button Component

**Files:**
- Create: `src/lib/components/auth/LoginButton.svelte`
- Create: `src/lib/components/auth/UserMenu.svelte`

**Step 1: Create LoginButton component**

```svelte
<!-- src/lib/components/auth/LoginButton.svelte -->
<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { LogIn } from 'lucide-svelte';
	import { login, isLoading } from '$lib/stores/auth.svelte';

	const loading = $derived(isLoading());
</script>

<Button variant="outline" onclick={login} disabled={loading}>
	<LogIn class="mr-2 h-4 w-4" />
	{loading ? 'Loading...' : 'Sign in'}
</Button>
```

**Step 2: Create UserMenu component**

```svelte
<!-- src/lib/components/auth/UserMenu.svelte -->
<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Button } from '$lib/components/ui/button';
	import { User, LogOut, Settings } from 'lucide-svelte';
	import { getUser, logout } from '$lib/stores/auth.svelte';

	const user = $derived(getUser());

	function getInitials(name: string | null): string {
		if (!name) return '?';
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}
</script>

{#if user}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button variant="ghost" class="relative h-9 w-9 rounded-full" {...props}>
					{#if user.avatarUrl}
						<img
							src={user.avatarUrl}
							alt={user.name ?? 'User avatar'}
							class="h-9 w-9 rounded-full object-cover"
						/>
					{:else}
						<div
							class="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium"
						>
							{getInitials(user.name)}
						</div>
					{/if}
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" class="w-56">
			<DropdownMenu.Label>
				<div class="flex flex-col space-y-1">
					<p class="text-sm font-medium">{user.name ?? 'User'}</p>
					{#if user.email}
						<p class="text-xs text-muted-foreground">{user.email}</p>
					{/if}
				</div>
			</DropdownMenu.Label>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onclick={logout}>
				<LogOut class="mr-2 h-4 w-4" />
				Sign out
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/if}
```

**Step 3: Commit**

```bash
git add src/lib/components/auth/
git commit -m "feat: add LoginButton and UserMenu components"
```

---

### Task 3.3: Integrate Auth into Layout

**Files:**
- Modify: `src/routes/+layout.svelte`
- Modify: `src/lib/components/layout/Header.svelte`

**Step 1: Update layout to fetch user on mount**

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { fetchUser } from '$lib/stores/auth.svelte';

	let { children } = $props();

	onMount(() => {
		fetchUser();
	});
</script>

{@render children()}
```

**Step 2: Read current Header.svelte to understand structure**

Run: Read `src/lib/components/layout/Header.svelte`

**Step 3: Update Header.svelte to include auth components**

Add imports and auth UI to the header (exact changes depend on current file structure - will need to read file first).

**Step 4: Commit**

```bash
git add src/routes/+layout.svelte src/lib/components/layout/Header.svelte
git commit -m "feat: integrate auth into layout and header"
```

---

## Phase 4: Project API Endpoints

### Task 4.1: Create Project CRUD Helpers

**Files:**
- Create: `src/lib/server/projects.ts`

**Step 1: Create project database operations**

```typescript
// src/lib/server/projects.ts
import { getDB } from './db';
import type { DBProject, DBItem, DBFloorplan, ProjectWithRole, ProjectRole } from './types';

export async function getUserProjects(userId: string): Promise<ProjectWithRole[]> {
	const db = getDB();
	const projects = await db`
		SELECT p.*, pm.role
		FROM projects p
		JOIN project_members pm ON p.id = pm.project_id
		WHERE pm.user_id = ${userId}
		ORDER BY p.updated_at DESC
	`;
	return projects as ProjectWithRole[];
}

export async function getProjectById(projectId: string): Promise<DBProject | null> {
	const db = getDB();
	const [project] = await db`
		SELECT * FROM projects WHERE id = ${projectId}
	`;
	return (project as DBProject) ?? null;
}

export async function getProjectRole(
	projectId: string,
	userId: string
): Promise<ProjectRole | null> {
	const db = getDB();
	const [member] = await db`
		SELECT role FROM project_members
		WHERE project_id = ${projectId} AND user_id = ${userId}
	`;
	return member?.role ?? null;
}

export async function createProject(
	ownerId: string,
	name: string,
	currency: string = 'EUR',
	gridSize: number = 20
): Promise<DBProject> {
	const db = getDB();
	const [project] = await db`
		INSERT INTO projects (owner_id, name, currency, grid_size)
		VALUES (${ownerId}, ${name}, ${currency}, ${gridSize})
		RETURNING *
	`;

	// Add owner as project member
	await db`
		INSERT INTO project_members (project_id, user_id, role)
		VALUES (${project.id}, ${ownerId}, 'owner')
	`;

	return project as DBProject;
}

export async function updateProject(
	projectId: string,
	data: { name?: string; currency?: string; gridSize?: number }
): Promise<DBProject> {
	const db = getDB();
	const [project] = await db`
		UPDATE projects SET
			name = COALESCE(${data.name ?? null}, name),
			currency = COALESCE(${data.currency ?? null}, currency),
			grid_size = COALESCE(${data.gridSize ?? null}, grid_size),
			updated_at = NOW()
		WHERE id = ${projectId}
		RETURNING *
	`;
	return project as DBProject;
}

export async function deleteProject(projectId: string): Promise<void> {
	const db = getDB();
	await db`DELETE FROM projects WHERE id = ${projectId}`;
}

export async function getProjectItems(projectId: string): Promise<DBItem[]> {
	const db = getDB();
	const items = await db`
		SELECT * FROM items WHERE project_id = ${projectId}
		ORDER BY created_at ASC
	`;
	return items as DBItem[];
}

export async function getProjectFloorplan(projectId: string): Promise<DBFloorplan | null> {
	const db = getDB();
	const [floorplan] = await db`
		SELECT * FROM floorplans WHERE project_id = ${projectId}
		ORDER BY created_at DESC LIMIT 1
	`;
	return (floorplan as DBFloorplan) ?? null;
}
```

**Step 2: Commit**

```bash
git add src/lib/server/projects.ts
git commit -m "feat: add project CRUD database operations"
```

---

### Task 4.2: Create Project API Endpoints

**Files:**
- Create: `src/routes/api/projects/+server.ts`
- Create: `src/routes/api/projects/[id]/+server.ts`

**Step 1: Create projects list/create endpoint**

```typescript
// src/routes/api/projects/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserProjects, createProject } from '$lib/server/projects';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const projects = await getUserProjects(locals.user.id);
	return json({ projects });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const body = await request.json();
	const { name, currency, gridSize } = body;

	if (!name || typeof name !== 'string') {
		throw error(400, 'Project name is required');
	}

	const project = await createProject(locals.user.id, name, currency, gridSize);
	return json({ project }, { status: 201 });
};
```

**Step 2: Create single project endpoint**

```typescript
// src/routes/api/projects/[id]/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getProjectById,
	getProjectRole,
	getProjectItems,
	getProjectFloorplan,
	updateProject,
	deleteProject
} from '$lib/server/projects';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role) {
		throw error(403, 'Access denied');
	}

	const project = await getProjectById(params.id);
	if (!project) {
		throw error(404, 'Project not found');
	}

	const [items, floorplan] = await Promise.all([
		getProjectItems(params.id),
		getProjectFloorplan(params.id)
	]);

	return json({ project, items, floorplan, role });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role || role === 'viewer') {
		throw error(403, 'Edit access required');
	}

	const body = await request.json();
	const project = await updateProject(params.id, body);

	return json({ project });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (role !== 'owner') {
		throw error(403, 'Owner access required');
	}

	await deleteProject(params.id);
	return json({ success: true });
};
```

**Step 3: Commit**

```bash
git add src/routes/api/projects/
git commit -m "feat: add project API endpoints"
```

---

### Task 4.3: Create Items API Endpoints

**Files:**
- Create: `src/lib/server/items.ts`
- Create: `src/routes/api/projects/[id]/items/+server.ts`
- Create: `src/routes/api/projects/[id]/items/[itemId]/+server.ts`

**Step 1: Create items database operations**

```typescript
// src/lib/server/items.ts
import { getDB } from './db';
import type { DBItem } from './types';

export async function createItem(
	projectId: string,
	data: Omit<DBItem, 'id' | 'project_id' | 'created_at' | 'updated_at'>
): Promise<DBItem> {
	const db = getDB();
	const [item] = await db`
		INSERT INTO items (
			project_id, name, width, height, x, y, rotation, color,
			price, price_currency, product_url, shape,
			cutout_width, cutout_height, cutout_corner
		) VALUES (
			${projectId}, ${data.name}, ${data.width}, ${data.height},
			${data.x}, ${data.y}, ${data.rotation}, ${data.color},
			${data.price}, ${data.price_currency}, ${data.product_url},
			${data.shape}, ${data.cutout_width}, ${data.cutout_height}, ${data.cutout_corner}
		)
		RETURNING *
	`;

	// Update project timestamp
	await db`UPDATE projects SET updated_at = NOW() WHERE id = ${projectId}`;

	return item as DBItem;
}

export async function updateItem(
	itemId: string,
	data: Partial<Omit<DBItem, 'id' | 'project_id' | 'created_at' | 'updated_at'>>
): Promise<DBItem> {
	const db = getDB();

	// Build dynamic update - only update provided fields
	const [item] = await db`
		UPDATE items SET
			name = COALESCE(${data.name ?? null}, name),
			width = COALESCE(${data.width ?? null}, width),
			height = COALESCE(${data.height ?? null}, height),
			x = ${data.x !== undefined ? data.x : null},
			y = ${data.y !== undefined ? data.y : null},
			rotation = COALESCE(${data.rotation ?? null}, rotation),
			color = COALESCE(${data.color ?? null}, color),
			price = ${data.price !== undefined ? data.price : null},
			price_currency = COALESCE(${data.price_currency ?? null}, price_currency),
			product_url = ${data.product_url !== undefined ? data.product_url : null},
			shape = COALESCE(${data.shape ?? null}, shape),
			cutout_width = ${data.cutout_width !== undefined ? data.cutout_width : null},
			cutout_height = ${data.cutout_height !== undefined ? data.cutout_height : null},
			cutout_corner = ${data.cutout_corner !== undefined ? data.cutout_corner : null},
			updated_at = NOW()
		WHERE id = ${itemId}
		RETURNING *
	`;

	// Update project timestamp
	if (item) {
		await db`UPDATE projects SET updated_at = NOW() WHERE id = ${item.project_id}`;
	}

	return item as DBItem;
}

export async function deleteItem(itemId: string): Promise<void> {
	const db = getDB();
	const [item] = await db`DELETE FROM items WHERE id = ${itemId} RETURNING project_id`;
	if (item) {
		await db`UPDATE projects SET updated_at = NOW() WHERE id = ${item.project_id}`;
	}
}

export async function getItemById(itemId: string): Promise<DBItem | null> {
	const db = getDB();
	const [item] = await db`SELECT * FROM items WHERE id = ${itemId}`;
	return (item as DBItem) ?? null;
}
```

**Step 2: Create items list/create endpoint**

```typescript
// src/routes/api/projects/[id]/items/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole, getProjectItems } from '$lib/server/projects';
import { createItem } from '$lib/server/items';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role) {
		throw error(403, 'Access denied');
	}

	const items = await getProjectItems(params.id);
	return json({ items });
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role || role === 'viewer') {
		throw error(403, 'Edit access required');
	}

	const body = await request.json();
	const item = await createItem(params.id, {
		name: body.name,
		width: body.width,
		height: body.height,
		x: body.x ?? null,
		y: body.y ?? null,
		rotation: body.rotation ?? 0,
		color: body.color ?? '#3b82f6',
		price: body.price ?? null,
		price_currency: body.priceCurrency ?? 'EUR',
		product_url: body.productUrl ?? null,
		shape: body.shape ?? 'rectangle',
		cutout_width: body.cutoutWidth ?? null,
		cutout_height: body.cutoutHeight ?? null,
		cutout_corner: body.cutoutCorner ?? null
	});

	return json({ item }, { status: 201 });
};
```

**Step 3: Create single item endpoint**

```typescript
// src/routes/api/projects/[id]/items/[itemId]/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole } from '$lib/server/projects';
import { getItemById, updateItem, deleteItem } from '$lib/server/items';

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role || role === 'viewer') {
		throw error(403, 'Edit access required');
	}

	const existingItem = await getItemById(params.itemId);
	if (!existingItem || existingItem.project_id !== params.id) {
		throw error(404, 'Item not found');
	}

	const body = await request.json();
	const item = await updateItem(params.itemId, body);

	return json({ item });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role || role === 'viewer') {
		throw error(403, 'Edit access required');
	}

	const existingItem = await getItemById(params.itemId);
	if (!existingItem || existingItem.project_id !== params.id) {
		throw error(404, 'Item not found');
	}

	await deleteItem(params.itemId);
	return json({ success: true });
};
```

**Step 4: Commit**

```bash
git add src/lib/server/items.ts src/routes/api/projects/[id]/items/
git commit -m "feat: add items API endpoints"
```

---

## Phase 5: Floorplan Upload & Image Serving

### Task 5.1: Create Floorplan Upload Endpoint

**Files:**
- Create: `src/lib/server/floorplans.ts`
- Create: `src/routes/api/projects/[id]/floorplan/+server.ts`

**Step 1: Create floorplan database operations**

```typescript
// src/lib/server/floorplans.ts
import { getDB } from './db';
import { config } from './env';
import type { DBFloorplan } from './types';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

export async function createFloorplan(
	projectId: string,
	data: {
		filename: string;
		originalName: string;
		mimeType: string;
		sizeBytes: number;
		scale?: number;
		referenceLength?: number;
	}
): Promise<DBFloorplan> {
	const db = getDB();

	// Delete existing floorplan for this project
	const [existing] = await db`
		SELECT filename FROM floorplans WHERE project_id = ${projectId}
	`;
	if (existing) {
		await deleteFloorplanFile(projectId, existing.filename);
		await db`DELETE FROM floorplans WHERE project_id = ${projectId}`;
	}

	const [floorplan] = await db`
		INSERT INTO floorplans (
			project_id, filename, original_name, mime_type, size_bytes, scale, reference_length
		) VALUES (
			${projectId}, ${data.filename}, ${data.originalName}, ${data.mimeType},
			${data.sizeBytes}, ${data.scale ?? null}, ${data.referenceLength ?? null}
		)
		RETURNING *
	`;

	await db`UPDATE projects SET updated_at = NOW() WHERE id = ${projectId}`;

	return floorplan as DBFloorplan;
}

export async function updateFloorplanScale(
	floorplanId: string,
	scale: number,
	referenceLength: number
): Promise<DBFloorplan> {
	const db = getDB();
	const [floorplan] = await db`
		UPDATE floorplans SET
			scale = ${scale},
			reference_length = ${referenceLength},
			updated_at = NOW()
		WHERE id = ${floorplanId}
		RETURNING *
	`;
	return floorplan as DBFloorplan;
}

export async function deleteFloorplan(projectId: string): Promise<void> {
	const db = getDB();
	const [floorplan] = await db`
		SELECT filename FROM floorplans WHERE project_id = ${projectId}
	`;
	if (floorplan) {
		await deleteFloorplanFile(projectId, floorplan.filename);
		await db`DELETE FROM floorplans WHERE project_id = ${projectId}`;
	}
}

export function getFloorplanDir(projectId: string): string {
	return join(config.uploads.dir, 'floorplans', projectId);
}

export function getFloorplanPath(projectId: string, filename: string): string {
	return join(getFloorplanDir(projectId), filename);
}

export async function saveFloorplanFile(
	projectId: string,
	filename: string,
	data: Buffer
): Promise<void> {
	const dir = getFloorplanDir(projectId);
	await mkdir(dir, { recursive: true });
	await writeFile(getFloorplanPath(projectId, filename), data);
}

async function deleteFloorplanFile(projectId: string, filename: string): Promise<void> {
	try {
		await unlink(getFloorplanPath(projectId, filename));
	} catch {
		// File may not exist
	}
}
```

**Step 2: Create floorplan upload endpoint**

```typescript
// src/routes/api/projects/[id]/floorplan/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole } from '$lib/server/projects';
import { createFloorplan, saveFloorplanFile, deleteFloorplan } from '$lib/server/floorplans';
import { config } from '$lib/server/env';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role || role === 'viewer') {
		throw error(403, 'Edit access required');
	}

	const formData = await request.formData();
	const file = formData.get('file') as File | null;

	if (!file) {
		throw error(400, 'No file provided');
	}

	if (!ALLOWED_TYPES.includes(file.type)) {
		throw error(400, 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF');
	}

	if (file.size > config.uploads.maxImageSize) {
		throw error(413, `File too large. Maximum size: ${config.uploads.maxImageSize / 1024 / 1024}MB`);
	}

	const ext = file.name.split('.').pop() ?? 'jpg';
	const filename = `${crypto.randomUUID()}.${ext}`;
	const buffer = Buffer.from(await file.arrayBuffer());

	await saveFloorplanFile(params.id, filename, buffer);

	const floorplan = await createFloorplan(params.id, {
		filename,
		originalName: file.name,
		mimeType: file.type,
		sizeBytes: file.size
	});

	return json({ floorplan }, { status: 201 });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role || role === 'viewer') {
		throw error(403, 'Edit access required');
	}

	await deleteFloorplan(params.id);
	return json({ success: true });
};
```

**Step 3: Commit**

```bash
git add src/lib/server/floorplans.ts src/routes/api/projects/[id]/floorplan/
git commit -m "feat: add floorplan upload endpoint with 5MB limit"
```

---

### Task 5.2: Create Image Serving Endpoint

**Files:**
- Create: `src/routes/api/images/floorplans/[projectId]/[filename]/+server.ts`

**Step 1: Create image serving endpoint with caching**

```typescript
// src/routes/api/images/floorplans/[projectId]/[filename]/+server.ts
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole, getProjectFloorplan } from '$lib/server/projects';
import { getFloorplanPath } from '$lib/server/floorplans';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export const GET: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.projectId, locals.user.id);
	if (!role) {
		throw error(403, 'Access denied');
	}

	const floorplan = await getProjectFloorplan(params.projectId);
	if (!floorplan || floorplan.filename !== params.filename) {
		throw error(404, 'Image not found');
	}

	const filePath = getFloorplanPath(params.projectId, params.filename);

	try {
		const [fileBuffer, fileStat] = await Promise.all([
			readFile(filePath),
			stat(filePath)
		]);

		// Generate ETag from file content
		const etag = createHash('md5').update(fileBuffer).digest('hex');

		// Check If-None-Match header for caching
		const ifNoneMatch = request.headers.get('if-none-match');
		if (ifNoneMatch === etag) {
			return new Response(null, { status: 304 });
		}

		return new Response(fileBuffer, {
			headers: {
				'Content-Type': floorplan.mime_type,
				'Content-Length': fileStat.size.toString(),
				'Cache-Control': 'public, max-age=31536000, immutable',
				'ETag': etag
			}
		});
	} catch {
		throw error(404, 'Image not found');
	}
};
```

**Step 2: Commit**

```bash
git add src/routes/api/images/
git commit -m "feat: add image serving endpoint with browser caching"
```

---

## Phase 6: Data Sync Layer

### Task 6.1: Create Sync Store

**Files:**
- Create: `src/lib/stores/sync.svelte.ts`

**Step 1: Create sync state management**

```typescript
// src/lib/stores/sync.svelte.ts
import { isAuthenticated } from './auth.svelte';

interface SyncState {
	isOnline: boolean;
	isSyncing: boolean;
	pendingChanges: number;
	lastSynced: Date | null;
	error: string | null;
}

let state = $state<SyncState>({
	isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
	isSyncing: false,
	pendingChanges: 0,
	lastSynced: null,
	error: null
});

// Pending changes queue (stored in memory, could persist to IndexedDB)
interface PendingChange {
	id: string;
	type: 'create' | 'update' | 'delete';
	entity: 'project' | 'item' | 'floorplan';
	projectId: string;
	entityId?: string;
	data?: unknown;
	timestamp: number;
}

let pendingQueue: PendingChange[] = $state([]);

export function getSyncState(): SyncState {
	return state;
}

export function isOnline(): boolean {
	return state.isOnline;
}

export function getPendingChanges(): number {
	return state.pendingChanges;
}

export function setOnline(online: boolean): void {
	state.isOnline = online;
	if (online && pendingQueue.length > 0) {
		processPendingChanges();
	}
}

export function queueChange(change: Omit<PendingChange, 'id' | 'timestamp'>): void {
	const newChange: PendingChange = {
		...change,
		id: crypto.randomUUID(),
		timestamp: Date.now()
	};
	pendingQueue.push(newChange);
	state.pendingChanges = pendingQueue.length;
}

export async function processPendingChanges(): Promise<void> {
	if (!isAuthenticated() || !state.isOnline || state.isSyncing) return;
	if (pendingQueue.length === 0) return;

	state.isSyncing = true;
	state.error = null;

	try {
		// Process changes in order
		while (pendingQueue.length > 0) {
			const change = pendingQueue[0];
			await processChange(change);
			pendingQueue.shift();
			state.pendingChanges = pendingQueue.length;
		}
		state.lastSynced = new Date();
	} catch (err) {
		state.error = err instanceof Error ? err.message : 'Sync failed';
		console.error('Sync error:', err);
	} finally {
		state.isSyncing = false;
	}
}

async function processChange(change: PendingChange): Promise<void> {
	const baseUrl = `/api/projects/${change.projectId}`;

	switch (change.entity) {
		case 'item':
			if (change.type === 'create') {
				await fetch(`${baseUrl}/items`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(change.data)
				});
			} else if (change.type === 'update' && change.entityId) {
				await fetch(`${baseUrl}/items/${change.entityId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(change.data)
				});
			} else if (change.type === 'delete' && change.entityId) {
				await fetch(`${baseUrl}/items/${change.entityId}`, {
					method: 'DELETE'
				});
			}
			break;

		case 'project':
			if (change.type === 'update') {
				await fetch(baseUrl, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(change.data)
				});
			}
			break;
	}
}

// Initialize online/offline listeners
if (typeof window !== 'undefined') {
	window.addEventListener('online', () => setOnline(true));
	window.addEventListener('offline', () => setOnline(false));
}
```

**Step 2: Commit**

```bash
git add src/lib/stores/sync.svelte.ts
git commit -m "feat: add sync store for offline queue management"
```

---

### Task 6.2: Create Unified Project Store

**Files:**
- Modify: `src/lib/stores/project.svelte.ts`

**Step 1: Read current project store**

Run: Read `src/lib/stores/project.svelte.ts`

**Step 2: Update project store to support dual storage**

This will be a significant modification - the store needs to:
- Check auth state to decide storage backend
- Call API when authenticated and online
- Fall back to IndexedDB when offline or unauthenticated
- Queue changes when offline

(Detailed implementation depends on current store structure - will need to adapt)

**Step 3: Commit**

```bash
git add src/lib/stores/project.svelte.ts
git commit -m "feat: update project store for dual storage support"
```

---

## Phase 7: WebSocket Server

### Task 7.1: Create WebSocket Manager

**Files:**
- Create: `src/lib/server/websocket.ts`
- Create: `src/lib/server/collaboration.ts`

**Step 1: Create collaboration room manager**

```typescript
// src/lib/server/collaboration.ts
import type { DBUser } from './types';

interface Cursor {
	x: number;
	y: number;
	timestamp: number;
}

interface CollaboratorState {
	user: {
		id: string;
		name: string | null;
		avatarUrl: string | null;
	};
	color: string;
	cursor: Cursor | null;
	selectedItemId: string | null;
	lockedItemId: string | null;
	lastActivity: number;
}

interface ProjectRoom {
	projectId: string;
	collaborators: Map<string, CollaboratorState>;
	lockedItems: Map<string, string>; // itemId -> userId
}

const COLORS = [
	'#ef4444', '#f97316', '#eab308', '#22c55e',
	'#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'
];

const rooms = new Map<string, ProjectRoom>();

export function getOrCreateRoom(projectId: string): ProjectRoom {
	let room = rooms.get(projectId);
	if (!room) {
		room = {
			projectId,
			collaborators: new Map(),
			lockedItems: new Map()
		};
		rooms.set(projectId, room);
	}
	return room;
}

export function addCollaborator(
	projectId: string,
	connectionId: string,
	user: DBUser
): CollaboratorState {
	const room = getOrCreateRoom(projectId);

	// Assign color (use one not in use, or cycle)
	const usedColors = new Set(
		Array.from(room.collaborators.values()).map((c) => c.color)
	);
	const color = COLORS.find((c) => !usedColors.has(c)) ?? COLORS[room.collaborators.size % COLORS.length];

	const state: CollaboratorState = {
		user: {
			id: user.id,
			name: user.name,
			avatarUrl: user.avatar_url
		},
		color,
		cursor: null,
		selectedItemId: null,
		lockedItemId: null,
		lastActivity: Date.now()
	};

	room.collaborators.set(connectionId, state);
	return state;
}

export function removeCollaborator(projectId: string, connectionId: string): void {
	const room = rooms.get(projectId);
	if (!room) return;

	const collaborator = room.collaborators.get(connectionId);
	if (collaborator?.lockedItemId) {
		room.lockedItems.delete(collaborator.lockedItemId);
	}

	room.collaborators.delete(connectionId);

	// Clean up empty rooms
	if (room.collaborators.size === 0) {
		rooms.delete(projectId);
	}
}

export function updateCursor(
	projectId: string,
	connectionId: string,
	x: number,
	y: number
): void {
	const room = rooms.get(projectId);
	const collaborator = room?.collaborators.get(connectionId);
	if (collaborator) {
		collaborator.cursor = { x, y, timestamp: Date.now() };
		collaborator.lastActivity = Date.now();
	}
}

export function lockItem(
	projectId: string,
	connectionId: string,
	itemId: string
): boolean {
	const room = rooms.get(projectId);
	if (!room) return false;

	// Check if already locked by someone else
	const existingLock = room.lockedItems.get(itemId);
	const collaborator = room.collaborators.get(connectionId);
	if (!collaborator) return false;

	if (existingLock && existingLock !== collaborator.user.id) {
		return false;
	}

	// Release any previous lock by this user
	if (collaborator.lockedItemId) {
		room.lockedItems.delete(collaborator.lockedItemId);
	}

	room.lockedItems.set(itemId, collaborator.user.id);
	collaborator.lockedItemId = itemId;
	collaborator.lastActivity = Date.now();
	return true;
}

export function unlockItem(projectId: string, connectionId: string): string | null {
	const room = rooms.get(projectId);
	if (!room) return null;

	const collaborator = room.collaborators.get(connectionId);
	if (!collaborator?.lockedItemId) return null;

	const itemId = collaborator.lockedItemId;
	room.lockedItems.delete(itemId);
	collaborator.lockedItemId = null;
	return itemId;
}

export function getCollaborators(projectId: string): CollaboratorState[] {
	const room = rooms.get(projectId);
	return room ? Array.from(room.collaborators.values()) : [];
}

export function getLockedItems(projectId: string): Map<string, string> {
	return rooms.get(projectId)?.lockedItems ?? new Map();
}

export function isItemLocked(projectId: string, itemId: string, excludeUserId?: string): boolean {
	const room = rooms.get(projectId);
	if (!room) return false;
	const lockHolder = room.lockedItems.get(itemId);
	return lockHolder !== undefined && lockHolder !== excludeUserId;
}
```

**Step 2: Commit**

```bash
git add src/lib/server/collaboration.ts
git commit -m "feat: add collaboration room manager for real-time state"
```

---

### Task 7.2: Create WebSocket Endpoint

**Note:** SvelteKit doesn't have native WebSocket support. We need to use a custom server or adapter. For Bun, we can extend the server.

**Files:**
- Create: `src/lib/server/ws-handler.ts`
- Modify: `vite.config.ts` (for development WebSocket proxy)

**Step 1: Create WebSocket message handler**

```typescript
// src/lib/server/ws-handler.ts
import type { ServerWebSocket } from 'bun';
import {
	addCollaborator,
	removeCollaborator,
	updateCursor,
	lockItem,
	unlockItem,
	getCollaborators
} from './collaboration';
import { getProjectRole } from './projects';
import { getSessionWithUser, parseSessionCookie } from './session';
import type { DBUser } from './types';

interface WSData {
	projectId: string;
	connectionId: string;
	user: DBUser;
}

type WSMessage =
	| { type: 'cursor_move'; x: number; y: number }
	| { type: 'lock_item'; itemId: string }
	| { type: 'unlock_item' }
	| { type: 'select_item'; itemId: string | null }
	| { type: 'item_updated'; item: unknown }
	| { type: 'item_created'; item: unknown }
	| { type: 'item_deleted'; itemId: string };

const projectConnections = new Map<string, Set<ServerWebSocket<WSData>>>();

export function broadcastToProject(
	projectId: string,
	message: unknown,
	excludeConnectionId?: string
): void {
	const connections = projectConnections.get(projectId);
	if (!connections) return;

	const data = JSON.stringify(message);
	for (const ws of connections) {
		if (ws.data.connectionId !== excludeConnectionId) {
			ws.send(data);
		}
	}
}

export async function handleWSUpgrade(
	req: Request,
	server: { upgrade: (req: Request, options: unknown) => boolean }
): Promise<Response | undefined> {
	const url = new URL(req.url);
	const match = url.pathname.match(/^\/ws\/projects\/([^/]+)$/);
	if (!match) return undefined;

	const projectId = match[1];
	const cookie = req.headers.get('cookie');
	const sessionId = parseSessionCookie(cookie);

	if (!sessionId) {
		return new Response('Unauthorized', { status: 401 });
	}

	const session = await getSessionWithUser(sessionId);
	if (!session) {
		return new Response('Unauthorized', { status: 401 });
	}

	const role = await getProjectRole(projectId, session.user.id);
	if (!role) {
		return new Response('Forbidden', { status: 403 });
	}

	const connectionId = crypto.randomUUID();
	const upgraded = server.upgrade(req, {
		data: {
			projectId,
			connectionId,
			user: session.user
		} satisfies WSData
	});

	return upgraded ? undefined : new Response('Upgrade failed', { status: 500 });
}

export function handleWSOpen(ws: ServerWebSocket<WSData>): void {
	const { projectId, connectionId, user } = ws.data;

	// Add to project connections
	let connections = projectConnections.get(projectId);
	if (!connections) {
		connections = new Set();
		projectConnections.set(projectId, connections);
	}
	connections.add(ws);

	// Add collaborator and get state
	const state = addCollaborator(projectId, connectionId, user);

	// Send current collaborators to new user
	const collaborators = getCollaborators(projectId);
	ws.send(JSON.stringify({
		type: 'init',
		collaborators: collaborators.filter((c) => c.user.id !== user.id),
		yourColor: state.color
	}));

	// Broadcast join to others
	broadcastToProject(
		projectId,
		{ type: 'user_joined', user: state.user, color: state.color },
		connectionId
	);
}

export function handleWSMessage(ws: ServerWebSocket<WSData>, message: string): void {
	const { projectId, connectionId, user } = ws.data;

	try {
		const msg = JSON.parse(message) as WSMessage;

		switch (msg.type) {
			case 'cursor_move':
				updateCursor(projectId, connectionId, msg.x, msg.y);
				broadcastToProject(
					projectId,
					{ type: 'cursor_move', userId: user.id, x: msg.x, y: msg.y },
					connectionId
				);
				break;

			case 'lock_item':
				if (lockItem(projectId, connectionId, msg.itemId)) {
					broadcastToProject(projectId, {
						type: 'item_locked',
						itemId: msg.itemId,
						userId: user.id
					});
				}
				break;

			case 'unlock_item': {
				const unlockedItemId = unlockItem(projectId, connectionId);
				if (unlockedItemId) {
					broadcastToProject(projectId, {
						type: 'item_unlocked',
						itemId: unlockedItemId
					});
				}
				break;
			}

			case 'item_updated':
			case 'item_created':
			case 'item_deleted':
				// Broadcast to others (the sender already has the update)
				broadcastToProject(projectId, msg, connectionId);
				break;
		}
	} catch (err) {
		console.error('WebSocket message error:', err);
	}
}

export function handleWSClose(ws: ServerWebSocket<WSData>): void {
	const { projectId, connectionId, user } = ws.data;

	// Remove from connections
	const connections = projectConnections.get(projectId);
	if (connections) {
		connections.delete(ws);
		if (connections.size === 0) {
			projectConnections.delete(projectId);
		}
	}

	// Remove collaborator (also releases locks)
	removeCollaborator(projectId, connectionId);

	// Broadcast leave
	broadcastToProject(projectId, { type: 'user_left', userId: user.id });
}
```

**Step 2: Commit**

```bash
git add src/lib/server/ws-handler.ts
git commit -m "feat: add WebSocket message handler for collaboration"
```

---

## Phase 8: Frontend Collaboration

### Task 8.1: Create Collaboration Store

**Files:**
- Create: `src/lib/stores/collaboration.svelte.ts`

**Step 1: Create collaboration state management**

```typescript
// src/lib/stores/collaboration.svelte.ts
import { isAuthenticated } from './auth.svelte';

interface RemoteUser {
	id: string;
	name: string | null;
	avatarUrl: string | null;
	color: string;
}

interface Cursor {
	x: number;
	y: number;
}

interface CollaborationState {
	isConnected: boolean;
	myColor: string | null;
	users: RemoteUser[];
	cursors: Map<string, Cursor>;
	lockedItems: Map<string, string>; // itemId -> userId
	selectedItems: Map<string, string>; // itemId -> userId
}

let state = $state<CollaborationState>({
	isConnected: false,
	myColor: null,
	users: [],
	cursors: new Map(),
	lockedItems: new Map(),
	selectedItems: new Map()
});

let ws: WebSocket | null = null;
let currentProjectId: string | null = null;
let cursorThrottleTimeout: ReturnType<typeof setTimeout> | null = null;

const CURSOR_THROTTLE_MS = 50;

export function getCollaborationState(): CollaborationState {
	return state;
}

export function getRemoteUsers(): RemoteUser[] {
	return state.users;
}

export function getRemoteCursors(): Map<string, Cursor> {
	return state.cursors;
}

export function getLockedItems(): Map<string, string> {
	return state.lockedItems;
}

export function isItemLockedByOther(itemId: string, myUserId: string): boolean {
	const lockHolder = state.lockedItems.get(itemId);
	return lockHolder !== undefined && lockHolder !== myUserId;
}

export function getUserColor(userId: string): string | undefined {
	return state.users.find((u) => u.id === userId)?.color;
}

export function connect(projectId: string): void {
	if (!isAuthenticated()) return;
	if (ws && currentProjectId === projectId) return;

	disconnect();

	const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
	const url = `${protocol}//${window.location.host}/ws/projects/${projectId}`;

	ws = new WebSocket(url);
	currentProjectId = projectId;

	ws.onopen = () => {
		state.isConnected = true;
	};

	ws.onclose = () => {
		state.isConnected = false;
		state.users = [];
		state.cursors = new Map();
		state.lockedItems = new Map();
		ws = null;
	};

	ws.onerror = (error) => {
		console.error('WebSocket error:', error);
	};

	ws.onmessage = (event) => {
		try {
			const msg = JSON.parse(event.data);
			handleMessage(msg);
		} catch (err) {
			console.error('Failed to parse WebSocket message:', err);
		}
	};
}

export function disconnect(): void {
	if (ws) {
		ws.close();
		ws = null;
	}
	currentProjectId = null;
	state.isConnected = false;
	state.users = [];
	state.cursors = new Map();
	state.lockedItems = new Map();
}

function handleMessage(msg: unknown): void {
	const message = msg as Record<string, unknown>;

	switch (message.type) {
		case 'init':
			state.myColor = message.yourColor as string;
			state.users = (message.collaborators as RemoteUser[]) ?? [];
			break;

		case 'user_joined':
			state.users = [
				...state.users,
				{
					id: message.user.id,
					name: message.user.name,
					avatarUrl: message.user.avatarUrl,
					color: message.color
				} as RemoteUser
			];
			break;

		case 'user_left':
			state.users = state.users.filter((u) => u.id !== message.userId);
			state.cursors.delete(message.userId as string);
			// Remove locks held by this user
			for (const [itemId, userId] of state.lockedItems) {
				if (userId === message.userId) {
					state.lockedItems.delete(itemId);
				}
			}
			break;

		case 'cursor_move':
			state.cursors.set(message.userId as string, {
				x: message.x as number,
				y: message.y as number
			});
			break;

		case 'item_locked':
			state.lockedItems.set(message.itemId as string, message.userId as string);
			break;

		case 'item_unlocked':
			state.lockedItems.delete(message.itemId as string);
			break;
	}
}

export function sendCursorMove(x: number, y: number): void {
	if (!ws || ws.readyState !== WebSocket.OPEN) return;

	// Throttle cursor updates
	if (cursorThrottleTimeout) return;

	cursorThrottleTimeout = setTimeout(() => {
		cursorThrottleTimeout = null;
	}, CURSOR_THROTTLE_MS);

	ws.send(JSON.stringify({ type: 'cursor_move', x, y }));
}

export function sendLockItem(itemId: string): void {
	if (!ws || ws.readyState !== WebSocket.OPEN) return;
	ws.send(JSON.stringify({ type: 'lock_item', itemId }));
}

export function sendUnlockItem(): void {
	if (!ws || ws.readyState !== WebSocket.OPEN) return;
	ws.send(JSON.stringify({ type: 'unlock_item' }));
}

export function sendItemUpdated(item: unknown): void {
	if (!ws || ws.readyState !== WebSocket.OPEN) return;
	ws.send(JSON.stringify({ type: 'item_updated', item }));
}

export function sendItemCreated(item: unknown): void {
	if (!ws || ws.readyState !== WebSocket.OPEN) return;
	ws.send(JSON.stringify({ type: 'item_created', item }));
}

export function sendItemDeleted(itemId: string): void {
	if (!ws || ws.readyState !== WebSocket.OPEN) return;
	ws.send(JSON.stringify({ type: 'item_deleted', itemId }));
}
```

**Step 2: Commit**

```bash
git add src/lib/stores/collaboration.svelte.ts
git commit -m "feat: add collaboration store for real-time state"
```

---

### Task 8.2: Create Remote Cursor Component

**Files:**
- Create: `src/lib/components/collaboration/RemoteCursor.svelte`
- Create: `src/lib/components/collaboration/OnlineUsers.svelte`

**Step 1: Create RemoteCursor component**

```svelte
<!-- src/lib/components/collaboration/RemoteCursor.svelte -->
<script lang="ts">
	interface Props {
		x: number;
		y: number;
		color: string;
		name: string | null;
		showLabel?: boolean;
	}

	let { x, y, color, name, showLabel = true }: Props = $props();

	// Label fades out after 2 seconds of no movement
	let labelVisible = $state(true);
	let fadeTimeout: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		// Reset visibility on position change
		labelVisible = true;
		if (fadeTimeout) clearTimeout(fadeTimeout);
		fadeTimeout = setTimeout(() => {
			labelVisible = false;
		}, 2000);

		return () => {
			if (fadeTimeout) clearTimeout(fadeTimeout);
		};
	});
</script>

<g transform="translate({x}, {y})" class="pointer-events-none">
	<!-- Cursor arrow -->
	<path
		d="M0 0 L0 16 L4 12 L8 20 L10 19 L6 11 L12 11 Z"
		fill={color}
		stroke="white"
		stroke-width="1"
	/>

	<!-- Name label -->
	{#if showLabel && name}
		<g
			transform="translate(14, 16)"
			class="transition-opacity duration-300"
			style:opacity={labelVisible ? 1 : 0}
		>
			<rect
				x="-2"
				y="-10"
				width={name.length * 7 + 8}
				height="14"
				rx="3"
				fill={color}
			/>
			<text
				x="2"
				y="0"
				fill="white"
				font-size="10"
				font-family="system-ui, sans-serif"
			>
				{name}
			</text>
		</g>
	{/if}
</g>
```

**Step 2: Create OnlineUsers component**

```svelte
<!-- src/lib/components/collaboration/OnlineUsers.svelte -->
<script lang="ts">
	import { getRemoteUsers, getCollaborationState } from '$lib/stores/collaboration.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';

	const MAX_VISIBLE = 4;

	const users = $derived(getRemoteUsers());
	const { isConnected } = $derived(getCollaborationState());

	const visibleUsers = $derived(users.slice(0, MAX_VISIBLE));
	const overflowCount = $derived(Math.max(0, users.length - MAX_VISIBLE));

	function getInitials(name: string | null): string {
		if (!name) return '?';
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}
</script>

{#if isConnected && users.length > 0}
	<div class="flex items-center -space-x-2">
		{#each visibleUsers as user (user.id)}
			<Tooltip.Root>
				<Tooltip.Trigger>
					<div
						class="h-8 w-8 rounded-full border-2 border-background flex items-center justify-center text-xs font-medium text-white"
						style:background-color={user.color}
					>
						{#if user.avatarUrl}
							<img
								src={user.avatarUrl}
								alt={user.name ?? 'User'}
								class="h-full w-full rounded-full object-cover"
							/>
						{:else}
							{getInitials(user.name)}
						{/if}
					</div>
				</Tooltip.Trigger>
				<Tooltip.Content>
					{user.name ?? 'Anonymous'}
				</Tooltip.Content>
			</Tooltip.Root>
		{/each}

		{#if overflowCount > 0}
			<div
				class="h-8 w-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium"
			>
				+{overflowCount}
			</div>
		{/if}
	</div>
{/if}
```

**Step 3: Commit**

```bash
git add src/lib/components/collaboration/
git commit -m "feat: add RemoteCursor and OnlineUsers components"
```

---

## Phase 9: Sharing & Invites

### Task 9.1: Create Members API Endpoints

**Files:**
- Create: `src/lib/server/members.ts`
- Create: `src/routes/api/projects/[id]/members/+server.ts`
- Create: `src/routes/api/projects/[id]/members/[userId]/+server.ts`
- Create: `src/routes/api/invites/[token]/+server.ts`

(Implementation details similar to previous API endpoints pattern)

---

### Task 9.2: Create Share Dialog Component

**Files:**
- Create: `src/lib/components/sharing/ShareDialog.svelte`
- Create: `src/lib/components/sharing/MemberList.svelte`
- Create: `src/lib/components/sharing/InviteForm.svelte`

(Implementation follows shadcn-svelte dialog pattern)

---

## Phase 10: Local Project Migration

### Task 10.1: Create Import Dialog

**Files:**
- Create: `src/lib/components/auth/ImportLocalProjectsModal.svelte`

**Step 1: Create import dialog component**

```svelte
<!-- src/lib/components/auth/ImportLocalProjectsModal.svelte -->
<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { getAllProjects } from '$lib/db';
	import type { Project } from '$lib/types';
	import { Upload, FolderOpen } from 'lucide-svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
		onImport: (projects: Project[]) => Promise<void>;
	}

	let { open = $bindable(), onClose, onImport }: Props = $props();

	let localProjects = $state<Project[]>([]);
	let selectedIds = $state<Set<string>>(new Set());
	let isLoading = $state(false);
	let isImporting = $state(false);

	$effect(() => {
		if (open) {
			loadLocalProjects();
		}
	});

	async function loadLocalProjects(): Promise<void> {
		isLoading = true;
		try {
			localProjects = await getAllProjects();
			// Select all by default
			selectedIds = new Set(localProjects.map((p) => p.id));
		} catch (err) {
			console.error('Failed to load local projects:', err);
		} finally {
			isLoading = false;
		}
	}

	function toggleProject(id: string): void {
		if (selectedIds.has(id)) {
			selectedIds.delete(id);
		} else {
			selectedIds.add(id);
		}
		selectedIds = new Set(selectedIds);
	}

	function toggleAll(): void {
		if (selectedIds.size === localProjects.length) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(localProjects.map((p) => p.id));
		}
	}

	async function handleImport(): Promise<void> {
		const projectsToImport = localProjects.filter((p) => selectedIds.has(p.id));
		if (projectsToImport.length === 0) {
			onClose();
			return;
		}

		isImporting = true;
		try {
			await onImport(projectsToImport);
			onClose();
		} catch (err) {
			console.error('Import failed:', err);
		} finally {
			isImporting = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<Upload class="h-5 w-5" />
				Import Local Projects
			</Dialog.Title>
			<Dialog.Description>
				You have {localProjects.length} project{localProjects.length !== 1 ? 's' : ''} saved locally.
				Select which ones to import to your account.
			</Dialog.Description>
		</Dialog.Header>

		{#if isLoading}
			<div class="py-8 text-center text-muted-foreground">Loading...</div>
		{:else if localProjects.length === 0}
			<div class="py-8 text-center text-muted-foreground">
				No local projects found.
			</div>
		{:else}
			<div class="space-y-3 max-h-64 overflow-y-auto py-4">
				<div class="flex items-center gap-2 pb-2 border-b">
					<Checkbox
						checked={selectedIds.size === localProjects.length}
						onCheckedChange={toggleAll}
					/>
					<span class="text-sm font-medium">Select all</span>
				</div>

				{#each localProjects as project (project.id)}
					<div class="flex items-center gap-3">
						<Checkbox
							checked={selectedIds.has(project.id)}
							onCheckedChange={() => toggleProject(project.id)}
						/>
						<FolderOpen class="h-4 w-4 text-muted-foreground" />
						<div class="flex-1 min-w-0">
							<p class="text-sm font-medium truncate">{project.name}</p>
							<p class="text-xs text-muted-foreground">
								{project.items.length} item{project.items.length !== 1 ? 's' : ''}
							</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<Dialog.Footer class="gap-2">
			<Button variant="outline" onclick={onClose}>
				Skip
			</Button>
			<Button
				onclick={handleImport}
				disabled={isImporting || selectedIds.size === 0}
			>
				{isImporting ? 'Importing...' : `Import ${selectedIds.size} project${selectedIds.size !== 1 ? 's' : ''}`}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
```

**Step 2: Commit**

```bash
git add src/lib/components/auth/ImportLocalProjectsModal.svelte
git commit -m "feat: add local project import dialog for first login"
```

---

## Summary

This plan covers:

1. **Phase 1**: Database & server setup (env, PostgreSQL, types)
2. **Phase 2**: Authentication (sessions, users, OIDC, API endpoints)
3. **Phase 3**: Frontend auth (store, components, layout integration)
4. **Phase 4**: Project API (CRUD for projects, items)
5. **Phase 5**: Floorplan upload & image serving (5MB limit, caching)
6. **Phase 6**: Data sync layer (offline queue, dual storage)
7. **Phase 7**: WebSocket server (rooms, locking, broadcasts)
8. **Phase 8**: Frontend collaboration (cursors, presence UI)
9. **Phase 9**: Sharing & invites (members, permissions)
10. **Phase 10**: Local project migration (import dialog)

Each task includes exact file paths, code, and commit messages.
