import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole, duplicateProject } from '#lib/server/projects.ts';

export const POST: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role) {
		throw error(403, 'Access denied');
	}

	const project = await duplicateProject(params.id, locals.user.id);

	return Response.json({ project: { id: project.id, name: project.name } });
};
