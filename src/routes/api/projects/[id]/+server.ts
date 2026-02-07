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
import { ensureMainBranch, getBranchById, getDefaultBranch, listProjectBranches } from '$lib/server/branches';

export const GET: RequestHandler = async ({ locals, params, url }) => {
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

	let defaultBranch = await getDefaultBranch(params.id);
	if (!defaultBranch) {
		defaultBranch = await ensureMainBranch(project.id, project.ownerId);
	}

	const requestedBranchId = url.searchParams.get('branch');
	const activeBranch = requestedBranchId
		? await getBranchById(params.id, requestedBranchId)
		: defaultBranch;

	if (!activeBranch) {
		throw error(404, 'Branch not found');
	}

	const [items, floorplan, branches] = await Promise.all([
		getProjectItems(params.id, activeBranch.id),
		getProjectFloorplan(params.id),
		listProjectBranches(params.id)
	]);

	return json({
		project,
		items,
		floorplan,
		role,
		branches,
		activeBranchId: activeBranch.id,
		defaultBranchId: defaultBranch.id
	});
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
	if (body.gridSize !== undefined && role !== 'owner') {
		throw error(403, 'Only project owner can change grid size');
	}

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
