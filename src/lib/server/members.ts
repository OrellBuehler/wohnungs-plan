import { getDB } from './db';
import type { DBProjectInvite, DBProjectMember, ProjectRole } from './types';

export interface ProjectMemberInfo {
	userId: string;
	email: string | null;
	name: string | null;
	avatarUrl: string | null;
	role: ProjectRole;
	invitedAt: Date;
}

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function getProjectMembers(projectId: string): Promise<ProjectMemberInfo[]> {
	const db = getDB();
	const members = await db`
		SELECT
			pm.user_id,
			pm.role,
			pm.invited_at,
			u.email,
			u.name,
			u.avatar_url
		FROM project_members pm
		JOIN users u ON u.id = pm.user_id
		WHERE pm.project_id = ${projectId}
		ORDER BY pm.invited_at ASC
	`;

	return (members as Array<Record<string, unknown>>).map((member) => ({
		userId: member.user_id as string,
		email: member.email as string | null,
		name: member.name as string | null,
		avatarUrl: member.avatar_url as string | null,
		role: member.role as ProjectRole,
		invitedAt: member.invited_at as Date
	}));
}

export async function addMember(
	projectId: string,
	userId: string,
	role: ProjectRole
): Promise<DBProjectMember> {
	const db = getDB();
	const [member] = await db`
		INSERT INTO project_members (project_id, user_id, role)
		VALUES (${projectId}, ${userId}, ${role})
		ON CONFLICT (project_id, user_id) DO UPDATE SET
			role = EXCLUDED.role
		RETURNING *
	`;
	return member as DBProjectMember;
}

export async function updateMemberRole(
	projectId: string,
	userId: string,
	role: ProjectRole
): Promise<void> {
	const db = getDB();
	await db`
		UPDATE project_members SET role = ${role}
		WHERE project_id = ${projectId} AND user_id = ${userId}
	`;
}

export async function removeMember(projectId: string, userId: string): Promise<void> {
	const db = getDB();
	await db`
		DELETE FROM project_members WHERE project_id = ${projectId} AND user_id = ${userId}
	`;
}

export async function createInvite(
	projectId: string,
	email: string,
	role: ProjectRole
): Promise<DBProjectInvite> {
	const db = getDB();
	const token = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

	const [invite] = await db`
		INSERT INTO project_invites (project_id, email, role, token, expires_at)
		VALUES (${projectId}, ${email}, ${role}, ${token}, ${expiresAt})
		RETURNING *
	`;

	return invite as DBProjectInvite;
}

export async function getInviteByToken(token: string): Promise<DBProjectInvite | null> {
	const db = getDB();
	const [invite] = await db`
		SELECT * FROM project_invites WHERE token = ${token}
	`;
	return (invite as DBProjectInvite) ?? null;
}

export async function acceptInvite(
	invite: DBProjectInvite,
	userId: string
): Promise<void> {
	const db = getDB();
	await db`
		INSERT INTO project_members (project_id, user_id, role)
		VALUES (${invite.project_id}, ${userId}, ${invite.role})
		ON CONFLICT (project_id, user_id) DO NOTHING
	`;

	await db`
		UPDATE project_invites SET accepted_at = NOW()
		WHERE id = ${invite.id}
	`;
}
