import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getShareAuthCookieName,
	getShareLinkByToken,
	isShareLinkValid,
	verifyShareAuthCookie
} from '$lib/server/share-links';
import { getProjectFloorplan } from '$lib/server/projects';
import { getFloorplanPath } from '$lib/server/floorplans';
import { readFile, stat } from 'node:fs/promises';
import { serveFileWithEtag } from '$lib/server/http';

export const GET: RequestHandler = async ({ params, cookies, request }) => {
	const link = await getShareLinkByToken(params.token);
	if (!link || !isShareLinkValid(link)) {
		throw error(404, 'Share link not found');
	}

	if (link.passwordHash) {
		const cookieName = getShareAuthCookieName(link.token);
		const cookieValue = cookies.get(cookieName) ?? '';
		if (!verifyShareAuthCookie(cookieValue, link.id)) {
			throw error(401, 'Password required');
		}
	}

	const floorplan = await getProjectFloorplan(link.projectId);
	if (!floorplan) {
		throw error(404, 'Image not found');
	}

	const filePath = getFloorplanPath(link.projectId, floorplan.filename);

	try {
		const [fileBuffer, fileStat] = await Promise.all([
			readFile(filePath),
			stat(filePath)
		]);

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
