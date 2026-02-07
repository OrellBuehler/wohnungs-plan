import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBranchById } from '$lib/server/branches';
import { deleteItem, getItemById, updateItem } from '$lib/server/items';
import { getProjectRole } from '$lib/server/projects';

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

	const existingItem = await getItemById(params.id, params.branchId, params.itemId);
	if (!existingItem) {
		throw error(404, 'Item not found');
	}

	const body = await request.json();
	const item = await updateItem(params.id, params.branchId, params.itemId, locals.user.id, {
		name: body.name,
		width: body.width,
		height: body.height,
		x: body.x ?? body.position?.x ?? undefined,
		y: body.y ?? body.position?.y ?? undefined,
		rotation: body.rotation,
		color: body.color,
		price: body.price,
		priceCurrency: body.priceCurrency,
		productUrl: body.productUrl,
		shape: body.shape,
		cutoutWidth: body.cutoutWidth,
		cutoutHeight: body.cutoutHeight,
		cutoutCorner: body.cutoutCorner
	});

	return json({ item });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
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

	const existingItem = await getItemById(params.id, params.branchId, params.itemId);
	if (!existingItem) {
		throw error(404, 'Item not found');
	}

	await deleteItem(params.id, params.branchId, params.itemId, locals.user.id);
	return json({ success: true });
};
