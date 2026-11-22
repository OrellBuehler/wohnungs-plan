import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBranchById } from '#lib/server/branches.ts';
import { revertItemChanges } from '#lib/server/items.ts';
import { getProjectRole } from '#lib/server/projects.ts';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (role !== 'owner') {
		throw error(403, 'Owner access required');
	}

	const branch = await getBranchById(params.id, params.branchId);
	if (!branch) {
		throw error(404, 'Branch not found');
	}

	const body = await request.json();
	const changeIds = Array.isArray(body.changeIds)
		? body.changeIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
		: [];

	if (changeIds.length === 0) {
		throw error(400, 'changeIds must be a non-empty string array');
	}

	await revertItemChanges(params.id, params.branchId, locals.user.id, changeIds);
	return Response.json({ success: true, reverted: changeIds.length });
};
