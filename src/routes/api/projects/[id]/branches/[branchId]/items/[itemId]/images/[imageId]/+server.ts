import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole } from '$lib/server/projects';
import { getBranchById } from '$lib/server/branches';
import { getItemById, insertHistoryEntries } from '$lib/server/items';
import { deleteItemImage, getItemImages } from '$lib/server/item-images';

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

	const item = await getItemById(params.id, params.branchId, params.itemId);
	if (!item) {
		throw error(404, 'Item not found');
	}

	// Get image info before deletion for history
	const images = await getItemImages(params.itemId);
	const image = images.find((img) => img.id === params.imageId);
	if (!image) {
		throw error(404, 'Image not found');
	}

	const deleted = await deleteItemImage(params.id, params.itemId, params.imageId);
	if (!deleted) {
		throw error(404, 'Image not found');
	}

	await insertHistoryEntries([
		{
			projectId: params.id,
			branchId: params.branchId,
			itemId: params.itemId,
			userId: locals.user.id,
			action: 'update',
			field: 'image',
			oldValue: image.originalName ?? image.filename,
			newValue: null
		}
	]);

	return json({ success: true });
};
