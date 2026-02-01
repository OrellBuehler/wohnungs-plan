import { eq, and, asc } from 'drizzle-orm';
import { getDB, projectMembers, projectInvites, users, type ProjectMember, type ProjectInvite } from './db';
import type { ProjectRole } from './types';

export interface ProjectMemberInfo {
	userId: string;
	email: string | null;
	name: string | null;
	avatarUrl: string | null;
	role: ProjectRole;
	invitedAt: Date | null;
}

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function getProjectMembers(projectId: string): Promise<ProjectMemberInfo[]> {
	const db = getDB();
	const members = await db
		.select({
			userId: projectMembers.userId,
			role: projectMembers.role,
			invitedAt: projectMembers.invitedAt,
			email: users.email,
			name: users.name,
			avatarUrl: users.avatarUrl
		})
		.from(projectMembers)
		.innerJoin(users, eq(users.id, projectMembers.userId))
		.where(eq(projectMembers.projectId, projectId))
		.orderBy(asc(projectMembers.invitedAt));

	return members.map((member) => ({
		userId: member.userId,
		email: member.email,
		name: member.name,
		avatarUrl: member.avatarUrl,
		role: member.role as ProjectRole,
		invitedAt: member.invitedAt
	}));
}

export async function addMember(projectId: string, userId: string, role: ProjectRole): Promise<ProjectMember> {
	const db = getDB();
	const [member] = await db
		.insert(projectMembers)
		.values({
			projectId,
			userId,
			role
		})
		.onConflictDoUpdate({
			target: [projectMembers.projectId, projectMembers.userId],
			set: { role }
		})
		.returning();
	return member;
}

export async function updateMemberRole(projectId: string, userId: string, role: ProjectRole): Promise<void> {
	const db = getDB();
	await db
		.update(projectMembers)
		.set({ role })
		.where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
}

export async function removeMember(projectId: string, userId: string): Promise<void> {
	const db = getDB();
	await db
		.delete(projectMembers)
		.where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
}

export async function createInvite(projectId: string, email: string, role: ProjectRole): Promise<ProjectInvite> {
	const db = getDB();
	const token = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

	const [invite] = await db
		.insert(projectInvites)
		.values({
			projectId,
			email,
			role,
			token,
			expiresAt
		})
		.returning();

	return invite;
}

export async function getInviteByToken(token: string): Promise<ProjectInvite | null> {
	const db = getDB();
	const [invite] = await db.select().from(projectInvites).where(eq(projectInvites.token, token));
	return invite ?? null;
}

export async function acceptInvite(invite: ProjectInvite, userId: string): Promise<void> {
	const db = getDB();
	await db
		.insert(projectMembers)
		.values({
			projectId: invite.projectId,
			userId,
			role: invite.role
		})
		.onConflictDoNothing();

	await db.update(projectInvites).set({ acceptedAt: new Date() }).where(eq(projectInvites.id, invite.id));
}
