import { getProjectById } from '$lib/server/projects';
import type { PageServerLoad } from './$types';

const BASE_URL = 'https://floorplanner.orellbuehler.ch';

export const load: PageServerLoad = async ({ params }) => {
	let project;
	try {
		project = await getProjectById(params.id);
	} catch (e) {
		console.error('Failed to load project for SEO:', e);
		return { seo: null };
	}

	if (!project) {
		return { seo: null };
	}

	return {
		seo: {
			title: `${project.name} - Floorplanner`,
			description: 'View this floor plan on Floorplanner',
			image: `${BASE_URL}/api/images/thumbnails/${project.id}`,
			url: `${BASE_URL}/projects/${project.id}`
		}
	};
};
