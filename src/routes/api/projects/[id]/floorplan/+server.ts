import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole, getProjectFloorplan } from '$lib/server/projects';
import { createFloorplan, saveFloorplanFile, deleteFloorplan, updateFloorplanScale } from '$lib/server/floorplans';
import { config } from '$lib/server/env';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
const EXT_BY_MIME: Record<(typeof ALLOWED_MIME_TYPES)[number], string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif'
};

function detectImageMime(buffer: Buffer): (typeof ALLOWED_MIME_TYPES)[number] | null {
	if (buffer.length < 12) return null;
	// JPEG: FF D8 FF
	if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
	// PNG: 89 50 4E 47 0D 0A 1A 0A
	if (
		buffer[0] === 0x89 &&
		buffer[1] === 0x50 &&
		buffer[2] === 0x4e &&
		buffer[3] === 0x47 &&
		buffer[4] === 0x0d &&
		buffer[5] === 0x0a &&
		buffer[6] === 0x1a &&
		buffer[7] === 0x0a
	) {
		return 'image/png';
	}
	// GIF: "GIF87a" or "GIF89a"
	if (
		buffer[0] === 0x47 &&
		buffer[1] === 0x49 &&
		buffer[2] === 0x46 &&
		buffer[3] === 0x38 &&
		(buffer[4] === 0x37 || buffer[4] === 0x39) &&
		buffer[5] === 0x61
	) {
		return 'image/gif';
	}
	// WebP: "RIFF....WEBP"
	if (
		buffer[0] === 0x52 &&
		buffer[1] === 0x49 &&
		buffer[2] === 0x46 &&
		buffer[3] === 0x46 &&
		buffer[8] === 0x57 &&
		buffer[9] === 0x45 &&
		buffer[10] === 0x42 &&
		buffer[11] === 0x50
	) {
		return 'image/webp';
	}

	return null;
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role || role === 'viewer') {
		throw error(403, 'Edit access required');
	}

	const formData = await request.formData();
	const file = formData.get('file') as File | null;

	if (!file) {
		throw error(400, 'No file provided');
	}

	if (file.size > config.uploads.maxImageSize) {
		throw error(413, `File too large. Maximum size: ${config.uploads.maxImageSize / 1024 / 1024}MB`);
	}

	const buffer = Buffer.from(await file.arrayBuffer());
	const detectedMime = detectImageMime(buffer);
	if (!detectedMime || !(detectedMime in EXT_BY_MIME)) {
		throw error(400, 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF');
	}

	const filename = `${crypto.randomUUID()}.${EXT_BY_MIME[detectedMime]}`;

	await saveFloorplanFile(params.id, filename, buffer);

	const floorplan = await createFloorplan(params.id, {
		filename,
		originalName: file.name,
		mimeType: detectedMime,
		sizeBytes: file.size
	});

	return json({ floorplan }, { status: 201 });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role || role === 'viewer') {
		throw error(403, 'Edit access required');
	}

	const floorplan = await getProjectFloorplan(params.id);
	if (!floorplan) {
		throw error(404, 'Floorplan not found');
	}

	const body = await request.json();
	const { scale, referenceLength } = body;

	if (typeof scale !== 'number' || typeof referenceLength !== 'number') {
		throw error(400, 'scale and referenceLength are required');
	}

	const updated = await updateFloorplanScale(floorplan.id, scale, referenceLength);
	return json({ floorplan: updated });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role || role === 'viewer') {
		throw error(403, 'Edit access required');
	}

	await deleteFloorplan(params.id);
	return json({ success: true });
};
