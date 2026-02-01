import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole } from '$lib/server/projects';
import { getItemById, updateItem, deleteItem } from '$lib/server/items';

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role || role === 'viewer') {
		throw error(403, 'Edit access required');
	}

	const existingItem = await getItemById(params.itemId);
	if (!existingItem || existingItem.projectId !== params.id) {
		throw error(404, 'Item not found');
	}

	const body = await request.json();
	const item = await updateItem(params.itemId, {
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

	const existingItem = await getItemById(params.itemId);
	if (!existingItem || existingItem.projectId !== params.id) {
		throw error(404, 'Item not found');
	}

	await deleteItem(params.itemId);
	return json({ success: true });
};
