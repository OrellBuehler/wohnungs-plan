import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getInviteByToken } from '$lib/server/members';
import { getProjectById } from '$lib/server/projects';

function isExpired(expiresAt: Date): boolean {
	return new Date(expiresAt).getTime() < Date.now();
}

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const invite = await getInviteByToken(params.token);

	if (!invite) {
		throw error(404, 'Invite not found or expired');
	}

	if (invite.acceptedAt) {
		// Invite already accepted - redirect to the project
		throw redirect(302, `/projects/${invite.projectId}`);
	}

	if (isExpired(invite.expiresAt)) {
		throw error(410, 'This invite has expired');
	}

	const project = await getProjectById(invite.projectId);

	// If user is already logged in and email matches, check if we should auto-accept
	const autoAccept = url.searchParams.get('autoAccept') === 'true';

	return {
		invite: {
			token: params.token,
			projectId: invite.projectId,
			projectName: project?.name ?? 'Unknown Project',
			email: invite.email,
			role: invite.role,
			expiresAt: invite.expiresAt.toISOString()
		},
		user: locals.user ?? null,
		autoAccept
	};
};
