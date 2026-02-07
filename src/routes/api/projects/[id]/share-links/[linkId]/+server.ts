import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole } from '$lib/server/projects';
import { revokeShareLink } from '$lib/server/share-links';

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (role !== 'owner') {
		throw error(403, 'Owner access required');
	}

	const link = await revokeShareLink(params.linkId, params.id);
	if (!link) {
		throw error(404, 'Share link not found');
	}

	return json({ success: true });
};
