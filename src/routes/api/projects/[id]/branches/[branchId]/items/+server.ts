import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBranchById } from '#lib/server/branches.ts';
import { createItem, getBranchItems, parseItemCreateBody } from '#lib/server/items.ts';
import { getProjectRole } from '#lib/server/projects.ts';
import { getImagesByItems } from '#lib/server/item-images.ts';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role) {
		throw error(403, 'Access denied');
	}

	const branch = await getBranchById(params.id, params.branchId);
	if (!branch) {
		throw error(404, 'Branch not found');
	}

	const items = await getBranchItems(params.id, params.branchId);

	// Batch-fetch images for all items
	const itemIds = items.map((item: { id: string }) => item.id);
	const imagesMap = await getImagesByItems(params.id, itemIds);
	const itemsWithImages = items.map((item: { id: string }) => ({
		...item,
		images: imagesMap.get(item.id) ?? []
	}));

	return Response.json({ items: itemsWithImages });
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
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

	const body = await request.json();
	const item = await createItem(
		params.id,
		params.branchId,
		locals.user.id,
		parseItemCreateBody(body)
	);

	return Response.json({ item }, { status: 201 });
};
