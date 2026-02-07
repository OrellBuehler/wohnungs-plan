import type { PageServerLoad } from './$types';
import {
	getShareAuthCookieName,
	getShareLinkByToken,
	isShareLinkValid,
	verifyShareAuthCookie
} from '$lib/server/share-links';
import { getProjectById } from '$lib/server/projects';

const BASE_URL = 'https://floorplanner.orellbuehler.ch';

export const load: PageServerLoad = async ({ params, cookies }) => {
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

	return {
		token: params.token,
		seo: {
			title: `${project.name} - Shared Floorplan`,
			description: 'View a shared floor plan',
			url: `${BASE_URL}/share/${params.token}`
		}
	};
};
