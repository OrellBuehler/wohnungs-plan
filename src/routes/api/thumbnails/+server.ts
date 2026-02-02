import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { config } from '$lib/server/env';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function getThumbnailsDir(): string {
	return join(config.uploads.dir, 'thumbnails');
}

function getThumbnailPath(projectId: string): string {
	return join(getThumbnailsDir(), `${projectId}.png`);
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { projectId, imageData } = body;

		if (!projectId || typeof projectId !== 'string') {
			throw error(400, 'Missing or invalid projectId');
		}

		if (!imageData || typeof imageData !== 'string') {
			throw error(400, 'Missing or invalid imageData');
		}

		// Validate projectId format (UUID)
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
		if (!uuidRegex.test(projectId)) {
			throw error(400, 'Invalid projectId format');
		}

		const thumbnailsDir = getThumbnailsDir();
		console.log(`Saving thumbnail for ${projectId} to ${thumbnailsDir}`);

		// Ensure thumbnails directory exists
		await mkdir(thumbnailsDir, { recursive: true });

		// Decode base64 and save
		const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
		await writeFile(getThumbnailPath(projectId), Buffer.from(base64Data, 'base64'));

		console.log(`Thumbnail saved successfully for ${projectId}`);
		return json({ success: true });
	} catch (err) {
		// Re-throw SvelteKit errors as-is
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error('Failed to save thumbnail:', err);
		throw error(500, `Failed to save thumbnail: ${err instanceof Error ? err.message : String(err)}`);
	}
};
