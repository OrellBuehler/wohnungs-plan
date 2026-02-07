import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole } from '$lib/server/projects';
import { getBranchById } from '$lib/server/branches';
import { getItemById } from '$lib/server/items';
import { reorderItemImages } from '$lib/server/item-images';

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role || role === 'viewer') {
		throw error(403, 'Edit access required');
	}

	const branch = await getBranchById(params.id, params.branchId);
	if (!branch) {
		throw error(404, 'Branch not found');
	}

	const item = await getItemById(params.id, params.branchId, params.itemId);
	if (!item) {
		throw error(404, 'Item not found');
	}

	const body = await request.json();
	const { imageIds } = body;

	if (!Array.isArray(imageIds) || imageIds.length === 0) {
		throw error(400, 'imageIds array is required');
	}

	await reorderItemImages(params.itemId, imageIds);
	return json({ success: true });
};
