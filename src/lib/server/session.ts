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

type SameSiteValue = 'lax' | 'strict' | 'none' | 'Lax' | 'Strict' | 'None';

function formatSameSite(value?: SameSiteValue): 'Lax' | 'Strict' | 'None' {
	switch (value) {
		case 'strict':
		case 'Strict':
			return 'Strict';
		case 'none':
		case 'None':
			return 'None';
		default:
			return 'Lax';
	}
}

export function createSessionCookie(
	sessionId: string,
	options?: { secure?: boolean; sameSite?: SameSiteValue }
): string {
	const secure = options?.secure ?? config.infomaniak.redirectUri.startsWith('https');
	const sameSite = formatSameSite(options?.sameSite);
	return [
		`session=${sessionId}`,
		'Path=/',
		'HttpOnly',
		`SameSite=${sameSite}`,
		secure ? 'Secure' : '',
		`Max-Age=${SESSION_DURATION_MS / 1000}`
	]
		.filter(Boolean)
		.join('; ');
}

export function clearSessionCookie(options?: { secure?: boolean; sameSite?: SameSiteValue }): string {
	const secure = options?.secure ?? config.infomaniak.redirectUri.startsWith('https');
	const sameSite = formatSameSite(options?.sameSite);
	return [
		'session=',
		'Path=/',
		'HttpOnly',
		`SameSite=${sameSite}`,
		secure ? 'Secure' : '',
		'Max-Age=0'
	]
		.filter(Boolean)
		.join('; ');
}

export function parseSessionCookie(cookieHeader: string | null): string | null {
	if (!cookieHeader) return null;
	const match = cookieHeader.match(/session=([^;]+)/);
	return match ? match[1] : null;
}
