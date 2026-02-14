import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole } from '$lib/server/projects';
import { createItem, getBranchItems, parseItemCreateBody } from '$lib/server/items';
import { resolveDefaultBranch } from '$lib/server/branches';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role) {
		throw error(403, 'Access denied');
	}

	const branch = await resolveDefaultBranch(params.id);
	const items = await getBranchItems(params.id, branch.id);
	return json({ items });
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role || role === 'viewer') {
		throw error(403, 'Edit access required');
	}

	const branch = await resolveDefaultBranch(params.id);

	const body = await request.json();
	const item = await createItem(params.id, branch.id, locals.user.id, parseItemCreateBody(body));

	return json({ item }, { status: 201 });
};
