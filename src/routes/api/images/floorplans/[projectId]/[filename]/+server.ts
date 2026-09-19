import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole, getProjectFloorplan } from '$lib/server/projects';
import { getFloorplanPath } from '$lib/server/floorplans';
import { config } from '$lib/server/env';
import { readFile, stat } from 'node:fs/promises';
import { isInsideDir, serveFileWithEtag } from '$lib/server/http';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	if (!uuidRegex.test(params.projectId)) {
		throw error(400, 'Invalid path parameters');
	}

	const role = await getProjectRole(params.projectId, locals.user.id);
	if (!role) {
		throw error(403, 'Access denied');
	}

	const floorplan = await getProjectFloorplan(params.projectId);
	if (!floorplan || floorplan.filename !== params.filename) {
		throw error(404, 'Image not found');
	}

	const filePath = getFloorplanPath(params.projectId, floorplan.filename);

	if (!isInsideDir(filePath, config.uploads.dir)) {
		throw error(400, 'Invalid path parameters');
	}

	try {
		const [fileBuffer, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);

		return serveFileWithEtag(fileBuffer, request, {
			'Content-Type': floorplan.mimeType,
			'Content-Length': fileStat.size.toString(),
			'Cache-Control': 'private, max-age=0, must-revalidate',
			Vary: 'Cookie'
		});
	} catch {
		throw error(404, 'Image not found');
	}
};
