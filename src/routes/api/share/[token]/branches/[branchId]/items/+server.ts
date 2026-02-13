import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getShareAuthCookieName,
	getShareLinkByToken,
	isShareLinkValid,
	sanitizeItemsForShare,
	verifyShareAuthCookie
} from '$lib/server/share-links';
import { getProjectItems } from '$lib/server/projects';
import { getBranchById } from '$lib/server/branches';

export const GET: RequestHandler = async ({ params, cookies }) => {
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

	const branch = await getBranchById(link.projectId, params.branchId);
	if (!branch) {
		throw error(404, 'Branch not found');
	}

	const items = await getProjectItems(link.projectId, branch.id);
	return json({ items: sanitizeItemsForShare(items) });
};
