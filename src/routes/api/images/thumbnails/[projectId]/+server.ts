import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { getFloorplanPath } from '$lib/server/floorplans';
import { getProjectFloorplan, getProjectRole } from '$lib/server/projects';
import { getShareLinkByToken, isShareLinkValid } from '$lib/server/share-links';
import { serveFileWithEtag } from '$lib/server/http';
import { getThumbnailPath } from '$lib/server/thumbnails';

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
			cacheControl: 'private, max-age=3600',
			vary: 'Cookie'
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
			cacheControl: 'private, max-age=60',
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

async function isAuthorized(
	projectId: string,
	userId: string | undefined,
	token: string | null
): Promise<boolean> {
	if (userId) {
		const role = await getProjectRole(projectId, userId);
		if (role) return true;
	}

	// Fall back to share token authorization
	if (token) {
		const link = await getShareLinkByToken(token);
		if (link && isShareLinkValid(link) && link.projectId === projectId && !link.passwordHash) {
			return true;
		}
	}

	return false;
}

export const GET: RequestHandler = async ({ params, request, locals, url }) => {
	// Validate projectId format (UUID)
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	if (!uuidRegex.test(params.projectId)) {
		throw error(400, 'Invalid projectId format');
	}

	let imageData: ImageResponseData | null = null;

	// Authorize before serving anything project-specific
	const authorized = await isAuthorized(
		params.projectId,
		locals.user?.id,
		url.searchParams.get('token')
	);

	if (authorized) {
		imageData =
			(await readThumbnailImage(params.projectId)) ??
			(await readFloorplanFallback(params.projectId));
	}

	if (!imageData) {
		imageData = await readDefaultOgImage();
	}

	if (!imageData) {
		throw error(404, 'Thumbnail not found');
	}

	const headers: Record<string, string> = {
		'Content-Type': imageData.contentType,
		'Content-Length': imageData.contentLength.toString(),
		'Cache-Control': imageData.cacheControl
	};

	if (imageData.vary) {
		headers.Vary = imageData.vary;
	}

	return serveFileWithEtag(imageData.buffer, request, headers);
};
