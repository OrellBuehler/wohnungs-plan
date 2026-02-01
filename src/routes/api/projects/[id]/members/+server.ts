import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole } from '$lib/server/projects';
import { getProjectMembers, createInvite, addMember } from '$lib/server/members';
import { findUserByEmail } from '$lib/server/users';
import type { ProjectRole } from '$lib/server/types';

const ALLOWED_ROLES: ProjectRole[] = ['editor', 'viewer'];

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role) {
		throw error(403, 'Access denied');
	}

	const members = await getProjectMembers(params.id);
	return json({ members });
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (role !== 'owner') {
		throw error(403, 'Owner access required');
	}

	const body = await request.json();
	const email = typeof body.email === 'string' ? body.email.trim() : '';
	const inviteRole = body.role as ProjectRole;

	if (!email) {
		throw error(400, 'Email is required');
	}

	if (!ALLOWED_ROLES.includes(inviteRole)) {
		throw error(400, 'Invalid role');
	}

	const existingUser = await findUserByEmail(email);
	if (existingUser) {
		const member = await addMember(params.id, existingUser.id, inviteRole);
		return json({ member, invite: null });
	}

	const invite = await createInvite(params.id, email, inviteRole);
	return json({ invite });
};
