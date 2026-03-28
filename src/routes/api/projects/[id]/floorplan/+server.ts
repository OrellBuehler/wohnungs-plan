import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole, getProjectFloorplan } from '$lib/server/projects';
import {
	createFloorplan,
	saveFloorplanFile,
	deleteFloorplan,
	updateFloorplanScale
} from '$lib/server/floorplans';
import { config } from '$lib/server/env';
import { detectImageMime, EXT_BY_MIME } from '$lib/server/image-utils';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (role !== 'owner') {
		throw error(403, 'Owner access required');
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
	if (role !== 'owner') {
		throw error(403, 'Owner access required');
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
	if (role !== 'owner') {
		throw error(403, 'Owner access required');
	}

	await deleteFloorplan(params.id);
	return json({ success: true });
};
