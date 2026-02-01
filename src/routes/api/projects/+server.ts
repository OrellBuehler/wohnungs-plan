import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserProjects, createProject } from '$lib/server/projects';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const projects = await getUserProjects(locals.user.id);
	return json({ projects });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const body = await request.json();
	const { id, name, currency, gridSize } = body;

	if (!name || typeof name !== 'string') {
		throw error(400, 'Project name is required');
	}

	const project = await createProject(locals.user.id, name, currency, gridSize, id);
	return json({ project }, { status: 201 });
};
