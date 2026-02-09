import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectById, getProjectRole } from '$lib/server/projects';
import { getDefaultBranch, ensureMainBranch } from '$lib/server/branches';
import { getCommentsByBranch, createComment } from '$lib/server/comments';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role) {
		throw error(403, 'Access denied');
	}

	const branchIdParam = url.searchParams.get('branchId');
	let branchId: string;

	if (branchIdParam) {
		branchId = branchIdParam;
	} else {
		let branch = await getDefaultBranch(params.id);
		if (!branch) {
			const project = await getProjectById(params.id);
			if (!project) {
				throw error(404, 'Project not found');
			}
			branch = await ensureMainBranch(project.id, project.ownerId);
		}
		branchId = branch.id;
	}

	const comments = await getCommentsByBranch(params.id, branchId);
	return json({ comments });
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

	let branchId: string;
	if (body.branchId && typeof body.branchId === 'string') {
		branchId = body.branchId;
	} else {
		let branch = await getDefaultBranch(params.id);
		if (!branch) {
			const project = await getProjectById(params.id);
			if (!project) {
				throw error(404, 'Project not found');
			}
			branch = await ensureMainBranch(project.id, project.ownerId);
		}
		branchId = branch.id;
	}

	if (body.type !== 'canvas' && body.type !== 'item') {
		throw error(400, 'Invalid comment type. Must be "canvas" or "item"');
	}

	if (!body.body || typeof body.body !== 'string' || body.body.trim().length === 0) {
		throw error(400, 'Comment body is required');
	}

	if (body.body.length > 10000) {
		throw error(400, 'Comment body is too long (max 10,000 characters)');
	}

	if (body.type === 'canvas') {
		// x,y are optional for canvas comments (positionless comments allowed)
		if (body.x !== undefined && typeof body.x !== 'number') {
			throw error(400, 'Canvas comment x must be a number');
		}
		if (body.y !== undefined && typeof body.y !== 'number') {
			throw error(400, 'Canvas comment y must be a number');
		}
	}

	if (body.type === 'item') {
		if (!body.itemId || typeof body.itemId !== 'string') {
			throw error(400, 'Item comments require an itemId');
		}
	}

	const comment = await createComment({
		projectId: params.id,
		branchId,
		authorId: locals.user.id,
		type: body.type,
		itemId: body.type === 'item' ? body.itemId : null,
		x: body.type === 'canvas' ? (body.x ?? null) : null,
		y: body.type === 'canvas' ? (body.y ?? null) : null,
		body: body.body.trim()
	});

	return json({ comment }, { status: 201 });
};
