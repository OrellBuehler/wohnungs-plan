import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole } from '$lib/server/projects';
import { getProjectDisabledTools, updateProjectDisabledTools } from '$lib/server/projects';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role) {
		throw error(403, 'Access denied');
	}

	const disabledTools = await getProjectDisabledTools(params.id);
	return json({ disabledTools });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (role !== 'owner') {
		throw error(403, 'Owner access required');
	}

	const body = await request.json();
	if (
		!Array.isArray(body.disabledTools) ||
		!body.disabledTools.every((t: unknown) => typeof t === 'string')
	) {
		throw error(400, 'disabledTools must be an array of strings');
	}

	await updateProjectDisabledTools(params.id, body.disabledTools);
	return json({ disabledTools: body.disabledTools });
};
