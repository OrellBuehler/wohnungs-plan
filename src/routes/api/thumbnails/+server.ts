import { json, error } from '@sveltejs/kit';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import type { RequestHandler } from './$types';

const THUMBNAILS_DIR = 'static/thumbnails';

export const POST: RequestHandler = async ({ request }) => {
	const { projectId, imageData } = await request.json();

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

	// Ensure thumbnails directory exists
	if (!existsSync(THUMBNAILS_DIR)) {
		await mkdir(THUMBNAILS_DIR, { recursive: true });
	}

	// Decode base64 and save to static folder
	const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
	const filePath = `${THUMBNAILS_DIR}/${projectId}.png`;

	await writeFile(filePath, Buffer.from(base64Data, 'base64'));

	return json({ success: true });
};
