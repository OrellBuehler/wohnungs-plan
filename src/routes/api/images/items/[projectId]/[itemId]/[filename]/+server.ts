import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole } from '$lib/server/projects';
import {
	getItemImageByFilename,
	getItemImagePath,
	getItemImageThumbPath
} from '$lib/server/item-images';
import { config } from '$lib/server/env';
import { readFile, stat } from 'node:fs/promises';
import { isInsideDir, serveFileWithEtag } from '$lib/server/http';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({ locals, params, request, url }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	if (!uuidRegex.test(params.projectId) || !uuidRegex.test(params.itemId)) {
		throw error(400, 'Invalid path parameters');
	}

	if (!/^[a-f0-9-]+\.(jpg|jpeg|png|webp|gif)$/i.test(params.filename)) {
		throw error(400, 'Invalid filename');
	}

	const role = await getProjectRole(params.projectId, locals.user.id);
	if (!role) {
		throw error(403, 'Access denied');
	}

	const image = await getItemImageByFilename(params.projectId, params.itemId, params.filename);
	if (!image) {
		throw error(404, 'Image not found');
	}

	const isThumb = url.searchParams.get('thumb') === '1';
	const filePath = isThumb
		? getItemImageThumbPath(params.projectId, params.itemId, image.filename)
		: getItemImagePath(params.projectId, params.itemId, image.filename);

	if (!isInsideDir(filePath, config.uploads.dir)) {
		throw error(400, 'Invalid path parameters');
	}

	try {
		const [fileBuffer, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);

		return serveFileWithEtag(fileBuffer, request, {
			'Content-Type': isThumb ? 'image/jpeg' : image.mimeType,
			'Content-Length': fileStat.size.toString(),
			'Cache-Control': 'private, max-age=0, must-revalidate',
			Vary: 'Cookie'
		});
	} catch {
		throw error(404, 'Image not found');
	}
};
