import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole } from '$lib/server/projects';
import { getItemById, updateItem, deleteItem } from '$lib/server/items';
import { resolveDefaultBranch } from '$lib/server/branches';

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role || role === 'viewer') {
		throw error(403, 'Edit access required');
	}

	const branch = await resolveDefaultBranch(params.id);
	const existingItem = await getItemById(params.id, branch.id, params.itemId);
	if (!existingItem) {
		throw error(404, 'Item not found');
	}

	const body = await request.json();
	const item = await updateItem(params.id, branch.id, params.itemId, locals.user.id, {
		name: body.name,
		width: body.width,
		height: body.height,
		x: body.x !== undefined ? body.x : body.position?.x,
		y: body.y !== undefined ? body.y : body.position?.y,
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

	const branch = await resolveDefaultBranch(params.id);
	const existingItem = await getItemById(params.id, branch.id, params.itemId);
	if (!existingItem) {
		throw error(404, 'Item not found');
	}

	await deleteItem(params.id, branch.id, params.itemId, locals.user.id);
	return json({ success: true });
};
