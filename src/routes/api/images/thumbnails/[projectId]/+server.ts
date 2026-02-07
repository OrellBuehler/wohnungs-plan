import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { config } from '$lib/server/env';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { getFloorplanPath } from '$lib/server/floorplans';
import { getProjectFloorplan, getProjectRole } from '$lib/server/projects';

function getThumbnailPath(projectId: string): string {
	return join(config.uploads.dir, 'thumbnails', `${projectId}.png`);
}

function getDefaultOgImagePath(): string {
	return join(process.cwd(), 'static', 'og-image.png');
}

type ImageResponseData = {
	buffer: Buffer;
	contentType: string;
	contentLength: number;
	cacheControl: string;
	vary?: string;
};

async function readThumbnailImage(projectId: string): Promise<ImageResponseData | null> {
	try {
		const filePath = getThumbnailPath(projectId);
		const [buffer, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);
		return {
			buffer,
			contentType: 'image/png',
			contentLength: fileStat.size,
			cacheControl: 'public, max-age=3600'
		};
	} catch {
		return null;
	}
}

async function readFloorplanFallback(projectId: string): Promise<ImageResponseData | null> {
	const floorplan = await getProjectFloorplan(projectId);
	if (!floorplan) return null;

	try {
		const filePath = getFloorplanPath(projectId, floorplan.filename);
		const [buffer, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);
		return {
			buffer,
			contentType: floorplan.mimeType,
			contentLength: fileStat.size,
			cacheControl: 'private, max-age=0, must-revalidate',
			vary: 'Cookie'
		};
	} catch {
		return null;
	}
}

async function readDefaultOgImage(): Promise<ImageResponseData | null> {
	try {
		const filePath = getDefaultOgImagePath();
		const [buffer, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);
		return {
			buffer,
			contentType: 'image/png',
			contentLength: fileStat.size,
			cacheControl: 'public, max-age=86400'
		};
	} catch {
		return null;
	}
}

export const GET: RequestHandler = async ({ params, request, locals }) => {
	// Validate projectId format (UUID)
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	if (!uuidRegex.test(params.projectId)) {
		throw error(400, 'Invalid projectId format');
	}

	let imageData = await readThumbnailImage(params.projectId);

	if (!imageData && locals.user) {
		const role = await getProjectRole(params.projectId, locals.user.id);
		if (role) {
			imageData = await readFloorplanFallback(params.projectId);
		}
	}

	if (!imageData) {
		imageData = await readDefaultOgImage();
	}

	if (!imageData) {
		throw error(404, 'Thumbnail not found');
	}

	// Generate ETag from file content
	const etag = createHash('md5').update(imageData.buffer).digest('hex');

	// Check If-None-Match header for caching
	const ifNoneMatch = request.headers.get('if-none-match');
	if (ifNoneMatch === etag) {
		return new Response(null, { status: 304 });
	}

	const headers: Record<string, string> = {
		'Content-Type': imageData.contentType,
		'Content-Length': imageData.contentLength.toString(),
		'Cache-Control': imageData.cacheControl,
		ETag: etag
	};

	if (imageData.vary) {
		headers.Vary = imageData.vary;
	}

	const body = new Uint8Array(imageData.buffer);
	return new Response(body, { headers });
};
