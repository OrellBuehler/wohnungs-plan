import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole } from '$lib/server/projects';
import { getBranchById } from '$lib/server/branches';
import { getItemById } from '$lib/server/items';
import {
	getItemImages,
	createItemImage,
	saveItemImageFile,
	generateThumbnail,
	getItemImagePath,
	getItemImageThumbPath
} from '$lib/server/item-images';
import { insertHistoryEntries } from '$lib/server/items';
import { config } from '$lib/server/env';
import { detectImageMime, EXT_BY_MIME } from '$lib/server/image-utils';
import { unlink } from 'node:fs/promises';

const MAX_IMAGES_PER_ITEM = 20;

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role) {
		throw error(403, 'Access denied');
	}

	const images = await getItemImages(params.itemId);
	return json({ images });
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

	const item = await getItemById(params.id, params.branchId, params.itemId);
	if (!item) {
		throw error(404, 'Item not found');
	}

	// Check image count limit
	const existing = await getItemImages(params.itemId);
	if (existing.length >= MAX_IMAGES_PER_ITEM) {
		throw error(400, `Maximum ${MAX_IMAGES_PER_ITEM} images per item`);
	}

	const formData = await request.formData();
	const file = formData.get('file') as File | null;

	if (!file) {
		throw error(400, 'No file provided');
	}

	if (file.size > config.uploads.maxImageSize) {
		throw error(
			413,
			`File too large. Maximum size: ${config.uploads.maxImageSize / 1024 / 1024}MB`
		);
	}

	const buffer = Buffer.from(await file.arrayBuffer());
	const detectedMime = detectImageMime(buffer);
	if (!detectedMime || !(detectedMime in EXT_BY_MIME)) {
		throw error(400, 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF');
	}

	const filename = `${crypto.randomUUID()}.${EXT_BY_MIME[detectedMime]}`;

	await saveItemImageFile(params.id, params.itemId, filename, buffer);
	try {
		await generateThumbnail(params.id, params.itemId, filename);
	} catch (e) {
		// Clean up saved file on thumbnail failure
		try { await unlink(getItemImagePath(params.id, params.itemId, filename)); } catch { /* ignore */ }
		throw e;
	}

	try {
		const image = await createItemImage(params.id, params.itemId, {
			filename,
			originalName: file.name,
			mimeType: detectedMime,
			sizeBytes: file.size
		});

		await insertHistoryEntries([
			{
				projectId: params.id,
				branchId: params.branchId,
				itemId: params.itemId,
				userId: locals.user.id,
				action: 'update',
				field: 'image',
				oldValue: null,
				newValue: file.name
			}
		]);

		return json({ image }, { status: 201 });
	} catch (e) {
		// Clean up files on DB insert failure
		try { await unlink(getItemImagePath(params.id, params.itemId, filename)); } catch { /* ignore */ }
		try { await unlink(getItemImageThumbPath(params.id, params.itemId, filename)); } catch { /* ignore */ }
		throw e;
	}
};
