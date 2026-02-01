import { getProjectById } from '$lib/server/projects';
import type { PageServerLoad } from './$types';

const BASE_URL = 'https://floorplanner.orellbuehler.ch';

export const load: PageServerLoad = async ({ params }) => {
	const project = await getProjectById(params.id);

	if (!project) {
		return { seo: null };
	}

	return {
		seo: {
			title: `${project.name} - Floorplanner`,
			description: 'View this floor plan on Floorplanner',
			image: `${BASE_URL}/thumbnails/${project.id}.png`,
			url: `${BASE_URL}/projects/${project.id}`
		}
	};
};
