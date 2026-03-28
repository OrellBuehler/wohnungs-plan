import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole } from '$lib/server/projects';
import {
	getCommentById,
	resolveComment,
	updateCommentPosition,
	deleteComment
} from '$lib/server/comments';

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role || role === 'viewer') {
		throw error(403, 'Edit access required');
	}

	const comment = await getCommentById(params.commentId);
	if (!comment || comment.projectId !== params.id) {
		throw error(404, 'Comment not found');
	}

	const body = await request.json();

	if (typeof body.resolved === 'boolean') {
		await resolveComment(params.commentId, body.resolved);
	}

	if (typeof body.x === 'number' && typeof body.y === 'number') {
		await updateCommentPosition(params.commentId, body.x, body.y);
	}

	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role || role === 'viewer') {
		throw error(403, 'Edit access required');
	}

	const comment = await getCommentById(params.commentId);
	if (!comment || comment.projectId !== params.id) {
		throw error(404, 'Comment not found');
	}

	await deleteComment(params.commentId);

	return json({ success: true });
};
