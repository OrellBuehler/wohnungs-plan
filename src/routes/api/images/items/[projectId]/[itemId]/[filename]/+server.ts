import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole } from '$lib/server/projects';
import { getItemImagePath, getItemImageThumbPath } from '$lib/server/item-images';
import { readFile, stat } from 'node:fs/promises';
import { serveFileWithEtag } from '$lib/server/http';

export const GET: RequestHandler = async ({ locals, params, request, url }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.projectId, locals.user.id);
	if (!role) {
		throw error(403, 'Access denied');
	}

	const isThumb = url.searchParams.get('thumb') === '1';
	const filePath = isThumb
		? getItemImageThumbPath(params.projectId, params.itemId, params.filename)
		: getItemImagePath(params.projectId, params.itemId, params.filename);

	try {
		const [fileBuffer, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);

		// Determine content type from filename extension
		const ext = params.filename.split('.').pop()?.toLowerCase();
		const mimeTypes: Record<string, string> = {
			jpg: 'image/jpeg',
			jpeg: 'image/jpeg',
			png: 'image/png',
			webp: 'image/webp',
			gif: 'image/gif'
		};
		const contentType = isThumb ? 'image/jpeg' : (mimeTypes[ext ?? ''] ?? 'application/octet-stream');

		return serveFileWithEtag(fileBuffer, request, {
			'Content-Type': contentType,
			'Content-Length': fileStat.size.toString(),
			'Cache-Control': 'private, max-age=0, must-revalidate',
			Vary: 'Cookie'
		});
	} catch {
		throw error(404, 'Image not found');
	}
};
