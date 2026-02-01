import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getProjectById,
	getProjectRole,
	getProjectItems,
	getProjectFloorplan,
	updateProject,
	deleteProject
} from '$lib/server/projects';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role) {
		throw error(403, 'Access denied');
	}

	const project = await getProjectById(params.id);
	if (!project) {
		throw error(404, 'Project not found');
	}

	const [items, floorplan] = await Promise.all([
		getProjectItems(params.id),
		getProjectFloorplan(params.id)
	]);

	return json({ project, items, floorplan, role });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role || role === 'viewer') {
		throw error(403, 'Edit access required');
	}

	const body = await request.json();
	const project = await updateProject(params.id, body);

	return json({ project });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (role !== 'owner') {
		throw error(403, 'Owner access required');
	}

	await deleteProject(params.id);
	return json({ success: true });
};
