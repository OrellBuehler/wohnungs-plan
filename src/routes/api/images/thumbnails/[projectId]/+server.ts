import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { config } from '$lib/server/env';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

function getThumbnailPath(projectId: string): string {
	return join(config.uploads.dir, 'thumbnails', `${projectId}.png`);
}

export const GET: RequestHandler = async ({ params, request }) => {
	// Validate projectId format (UUID)
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	if (!uuidRegex.test(params.projectId)) {
		throw error(400, 'Invalid projectId format');
	}

	const filePath = getThumbnailPath(params.projectId);

	try {
		const [fileBuffer, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);

		// Generate ETag from file content
		const etag = createHash('md5').update(fileBuffer).digest('hex');

		// Check If-None-Match header for caching
		const ifNoneMatch = request.headers.get('if-none-match');
		if (ifNoneMatch === etag) {
			return new Response(null, { status: 304 });
		}

		return new Response(fileBuffer, {
			headers: {
				'Content-Type': 'image/png',
				'Content-Length': fileStat.size.toString(),
				'Cache-Control': 'public, max-age=3600',
				ETag: etag
			}
		});
	} catch {
		throw error(404, 'Thumbnail not found');
	}
};
