import type { PageServerLoad } from './$types';
import {
	getShareAuthCookieName,
	getShareLinkByToken,
	isShareLinkValid,
	verifyShareAuthCookie
} from '$lib/server/share-links';
import { getProjectById } from '$lib/server/projects';
import { config } from '$lib/server/env';

export const load: PageServerLoad = async ({ params, cookies, url }) => {
	const link = await getShareLinkByToken(params.token);
	if (!link || !isShareLinkValid(link)) {
		return { error: 'invalid' as const };
	}

	const project = await getProjectById(link.projectId);
	if (!project) {
		return { error: 'invalid' as const };
	}

	if (link.passwordHash) {
		const cookieName = getShareAuthCookieName(link.token);
		const cookieValue = cookies.get(cookieName) ?? '';
		if (!verifyShareAuthCookie(cookieValue, link.id)) {
			return {
				requiresPassword: true as const,
				projectName: project.name,
				token: params.token
			};
		}
	}

	const baseUrl = config.publicUrl || url.origin;

	return {
		token: params.token,
		seo: {
			title: `${project.name} - Shared Floorplan`,
			description: 'View a shared floor plan',
			image: `${baseUrl}/api/images/thumbnails/${link.projectId}?token=${encodeURIComponent(params.token)}`,
			url: `${baseUrl}/share/${params.token}`
		}
	};
};
