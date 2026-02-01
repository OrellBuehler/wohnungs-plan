import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole } from '$lib/server/projects';
import { getProjectMembers, updateMemberRole, removeMember } from '$lib/server/members';
import type { ProjectRole } from '$lib/server/types';

const ALLOWED_ROLES: ProjectRole[] = ['owner', 'editor', 'viewer'];

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (role !== 'owner') {
		throw error(403, 'Owner access required');
	}

	const body = await request.json();
	const nextRole = body.role as ProjectRole;
	if (!ALLOWED_ROLES.includes(nextRole)) {
		throw error(400, 'Invalid role');
	}

	const members = await getProjectMembers(params.id);
	const target = members.find((member) => member.userId === params.userId);
	if (!target) {
		throw error(404, 'Member not found');
	}

	if (target.role === 'owner' && nextRole !== 'owner') {
		throw error(400, 'Cannot change owner role');
	}

	await updateMemberRole(params.id, params.userId, nextRole);
	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (role !== 'owner') {
		throw error(403, 'Owner access required');
	}

	const members = await getProjectMembers(params.id);
	const target = members.find((member) => member.userId === params.userId);
	if (!target) {
		throw error(404, 'Member not found');
	}

	if (target.role === 'owner') {
		throw error(400, 'Cannot remove owner');
	}

	await removeMember(params.id, params.userId);
	return json({ success: true });
};
