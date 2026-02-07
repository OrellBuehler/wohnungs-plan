import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteBranch, getBranchById, renameBranch } from '$lib/server/branches';
import { getProjectRole } from '$lib/server/projects';

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role || role === 'viewer') {
		throw error(403, 'Edit access required');
	}

	const existing = await getBranchById(params.id, params.branchId);
	if (!existing) {
		throw error(404, 'Branch not found');
	}

	const body = await request.json();
	const name = typeof body.name === 'string' ? body.name.trim() : '';
	if (!name) {
		throw error(400, 'Branch name is required');
	}

	try {
		const branch = await renameBranch(params.id, params.branchId, name);
		if (!branch) {
			throw error(404, 'Branch not found');
		}
		return json({ branch });
	} catch (err) {
		if (err instanceof Error && err.message === 'Branch name is required') {
			throw error(400, err.message);
		}
		if (err instanceof Error && err.message.includes('duplicate key value')) {
			throw error(409, 'A branch with this name already exists');
		}
		throw err;
	}
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role || role === 'viewer') {
		throw error(403, 'Edit access required');
	}

	try {
		const branch = await deleteBranch(params.id, params.branchId);
		if (!branch) {
			throw error(404, 'Branch not found');
		}
		return json({ success: true, deletedBranchId: branch.id });
	} catch (err) {
		if (err instanceof Error && err.message === 'Cannot delete the last remaining branch') {
			throw error(409, err.message);
		}
		throw err;
	}
};
