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
