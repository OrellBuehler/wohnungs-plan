import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole, getProjectItems } from '$lib/server/projects';
import { createItem } from '$lib/server/items';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role) {
		throw error(403, 'Access denied');
	}

	const items = await getProjectItems(params.id);
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

	const body = await request.json();
	const item = await createItem(params.id, {
		id: body.id,
		name: body.name,
		width: body.width,
		height: body.height,
		x: body.x ?? null,
		y: body.y ?? null,
		rotation: body.rotation ?? 0,
		color: body.color ?? '#3b82f6',
		price: body.price ?? null,
		priceCurrency: body.priceCurrency ?? 'EUR',
		productUrl: body.productUrl ?? null,
		shape: body.shape ?? 'rectangle',
		cutoutWidth: body.cutoutWidth ?? null,
		cutoutHeight: body.cutoutHeight ?? null,
		cutoutCorner: body.cutoutCorner ?? null
	});

	return json({ item }, { status: 201 });
};
