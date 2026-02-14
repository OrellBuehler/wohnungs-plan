import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole } from '$lib/server/projects';
import { getCommentById, addReply } from '$lib/server/comments';

export const POST: RequestHandler = async ({ locals, params, request }) => {
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

	if (!body.body || typeof body.body !== 'string' || body.body.trim().length === 0) {
		throw error(400, 'Reply body is required');
	}

	if (body.body.length > 10000) {
		throw error(400, 'Reply body is too long (max 10,000 characters)');
	}

	const reply = await addReply({
		commentId: params.commentId,
		authorId: locals.user.id,
		body: body.body.trim()
	});

	return json({ reply }, { status: 201 });
};
