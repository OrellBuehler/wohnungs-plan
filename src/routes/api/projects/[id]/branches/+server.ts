import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createBranch, ensureMainBranch, listProjectBranches } from '$lib/server/branches';
import { getProjectById, getProjectRole } from '$lib/server/projects';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role) {
		throw error(403, 'Access denied');
	}

	let branches = await listProjectBranches(params.id);
	if (branches.length === 0) {
		const project = await getProjectById(params.id);
		if (!project) {
			throw error(404, 'Project not found');
		}
		await ensureMainBranch(project.id, project.ownerId);
		branches = await listProjectBranches(params.id);
	}

	return json({ branches });
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role || role === 'viewer') {
		throw error(403, 'Edit access required');
	}

	const body = await request.json();
	const name = typeof body.name === 'string' ? body.name.trim() : '';
	if (!name) {
		throw error(400, 'Branch name is required');
	}

	try {
		const branch = await createBranch(
			params.id,
			locals.user.id,
			name,
			body.forkFromBranchId ?? null
		);
		return json({ branch }, { status: 201 });
	} catch (err) {
		if (err instanceof Error && err.message === 'Branch name is required') {
			throw error(400, err.message);
		}
		if (err instanceof Error && err.message === 'Source branch not found') {
			throw error(404, err.message);
		}
		if (err instanceof Error && err.message.includes('duplicate key value')) {
			throw error(409, 'A branch with this name already exists');
		}
		throw err;
	}
};
