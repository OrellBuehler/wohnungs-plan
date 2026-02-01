import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getInviteByToken, acceptInvite } from '$lib/server/members';
import { getProjectById } from '$lib/server/projects';

function isExpired(expiresAt: Date): boolean {
	return new Date(expiresAt).getTime() < Date.now();
}

export const GET: RequestHandler = async ({ params }) => {
	const invite = await getInviteByToken(params.token);
	if (!invite) {
		throw error(404, 'Invite not found');
	}

	if (invite.accepted_at) {
		throw error(410, 'Invite already accepted');
	}

	if (isExpired(invite.expires_at)) {
		throw error(410, 'Invite expired');
	}

	const project = await getProjectById(invite.project_id);

	return json({
		invite: {
			projectId: invite.project_id,
			email: invite.email,
			role: invite.role,
			expiresAt: invite.expires_at,
			projectName: project?.name ?? null
		}
	});
};

export const POST: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const invite = await getInviteByToken(params.token);
	if (!invite) {
		throw error(404, 'Invite not found');
	}

	if (invite.accepted_at) {
		throw error(410, 'Invite already accepted');
	}

	if (isExpired(invite.expires_at)) {
		throw error(410, 'Invite expired');
	}

	if (invite.email && locals.user.email && invite.email.toLowerCase() !== locals.user.email.toLowerCase()) {
		throw error(403, 'Invite email does not match your account');
	}

	await acceptInvite(invite, locals.user.id);

	return json({ success: true, projectId: invite.project_id });
};
