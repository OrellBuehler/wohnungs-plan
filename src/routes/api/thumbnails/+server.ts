import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { config } from '$lib/server/env';
import { getProjectById, getProjectRole } from '$lib/server/projects';
import { ensureMainBranch, getDefaultBranch } from '$lib/server/branches';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function getThumbnailsDir(): string {
	return join(config.uploads.dir, 'thumbnails');
}

function getThumbnailPath(projectId: string): string {
	return join(getThumbnailsDir(), `${projectId}.png`);
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pngDataUrlRegex = /^data:image\/png;base64,[a-z0-9+/=\s]+$/i;

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	try {
		const body = await request.json();
		const { projectId, branchId, imageData } = body;

		if (!projectId || typeof projectId !== 'string') {
			throw error(400, 'Missing or invalid projectId');
		}

		if (!branchId || typeof branchId !== 'string') {
			throw error(400, 'Missing or invalid branchId');
		}

		if (!imageData || typeof imageData !== 'string') {
			throw error(400, 'Missing or invalid imageData');
		}

		if (!uuidRegex.test(projectId)) {
			throw error(400, 'Invalid projectId format');
		}

		if (!uuidRegex.test(branchId)) {
			throw error(400, 'Invalid branchId format');
		}

		if (!pngDataUrlRegex.test(imageData)) {
			throw error(400, 'Thumbnail must be a PNG data URL');
		}

		const role = await getProjectRole(projectId, locals.user.id);
		if (!role || role === 'viewer') {
			throw error(403, 'Edit access required');
		}

		const project = await getProjectById(projectId);
		if (!project) {
			throw error(404, 'Project not found');
		}

		let defaultBranch = await getDefaultBranch(projectId);
		if (!defaultBranch) {
			defaultBranch = await ensureMainBranch(projectId, project.ownerId);
		}

		if (branchId !== defaultBranch.id) {
			throw error(409, 'Thumbnails can only be updated from the default branch');
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
