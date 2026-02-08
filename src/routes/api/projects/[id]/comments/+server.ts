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

	let branch = await getDefaultBranch(params.id);
	if (!branch) {
		const project = await getProjectById(params.id);
		if (!project) {
			throw error(404, 'Project not found');
		}
		branch = await ensureMainBranch(project.id, project.ownerId);
	}

	const body = await request.json();

	if (body.type !== 'canvas' && body.type !== 'item') {
		throw error(400, 'Invalid comment type. Must be "canvas" or "item"');
	}

	if (!body.body || typeof body.body !== 'string' || body.body.trim().length === 0) {
		throw error(400, 'Comment body is required');
	}

	const comment = await createComment({
		projectId: params.id,
		branchId: branch.id,
		authorId: locals.user.id,
		type: body.type,
		itemId: body.itemId ?? null,
		x: body.x ?? null,
		y: body.y ?? null,
		body: body.body
	});

	return json({ comment }, { status: 201 });
};
