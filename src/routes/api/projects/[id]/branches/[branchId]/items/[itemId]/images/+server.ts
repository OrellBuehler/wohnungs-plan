import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole } from '$lib/server/projects';
import { getBranchById } from '$lib/server/branches';
import { getItemById } from '$lib/server/items';
import {
	getItemImages,
	createItemImage,
	saveItemImageFile,
	generateThumbnail
} from '$lib/server/item-images';
import { config } from '$lib/server/env';
import { detectImageMime, EXT_BY_MIME } from '$lib/server/image-utils';

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
	await generateThumbnail(params.id, params.itemId, filename);

	const image = await createItemImage(params.id, params.itemId, {
		filename,
		originalName: file.name,
		mimeType: detectedMime,
		sizeBytes: file.size
	});

	return json({ image }, { status: 201 });
};
