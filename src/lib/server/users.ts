import { eq } from 'drizzle-orm';
import { getDB, users, type User } from './db';
import type { UserProfile } from './types';

export type { UserProfile };

export async function findUserByInfomaniakSub(sub: string): Promise<User | null> {
	const db = getDB();
	const [user] = await db.select().from(users).where(eq(users.infomaniakSub, sub));
	return user ?? null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
	const db = getDB();
	const [user] = await db.select().from(users).where(eq(users.email, email));
	return user ?? null;
}

export async function updateUser(
	id: string,
	data: { email?: string; name?: string; avatarUrl?: string }
): Promise<User> {
	const db = getDB();
	const [user] = await db
		.update(users)
		.set({
			email: data.email,
			name: data.name,
			avatarUrl: data.avatarUrl,
			updatedAt: new Date()
		})
		.where(eq(users.id, id))
		.returning();
	return user;
}

export async function upsertUser(data: {
	infomaniakSub: string;
	email?: string;
	name?: string;
	avatarUrl?: string;
}): Promise<User> {
	const db = getDB();
	const [user] = await db
		.insert(users)
		.values({
			infomaniakSub: data.infomaniakSub,
			email: data.email ?? null,
			name: data.name ?? null,
			avatarUrl: data.avatarUrl ?? null
		})
		.onConflictDoUpdate({
			target: users.infomaniakSub,
			set: {
				email: data.email ?? undefined,
				name: data.name ?? undefined,
				avatarUrl: data.avatarUrl ?? undefined,
				updatedAt: new Date()
			}
		})
		.returning();
	return user;
}

export function toUserProfile(user: User): UserProfile {
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		avatarUrl: user.avatarUrl
	};
}
