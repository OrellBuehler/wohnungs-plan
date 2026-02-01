import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole, getProjectFloorplan } from '$lib/server/projects';
import { getFloorplanPath } from '$lib/server/floorplans';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export const GET: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.projectId, locals.user.id);
	if (!role) {
		throw error(403, 'Access denied');
	}

	const floorplan = await getProjectFloorplan(params.projectId);
	if (!floorplan || floorplan.filename !== params.filename) {
		throw error(404, 'Image not found');
	}

	const filePath = getFloorplanPath(params.projectId, params.filename);

	try {
		const [fileBuffer, fileStat] = await Promise.all([
			readFile(filePath),
			stat(filePath)
		]);

		// Generate ETag from file content
		const etag = createHash('md5').update(fileBuffer).digest('hex');

		// Check If-None-Match header for caching
		const ifNoneMatch = request.headers.get('if-none-match');
		if (ifNoneMatch === etag) {
			return new Response(null, { status: 304 });
		}

		return new Response(fileBuffer, {
			headers: {
				'Content-Type': floorplan.mimeType,
				'Content-Length': fileStat.size.toString(),
				'Cache-Control': 'private, max-age=0, must-revalidate',
				ETag: etag,
				Vary: 'Cookie'
			}
		});
	} catch {
		throw error(404, 'Image not found');
	}
};
