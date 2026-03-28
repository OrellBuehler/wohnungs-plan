import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getProjectById, getProjectRole } from '$lib/server/projects';
import { getBranchById, getDefaultBranch } from '$lib/server/branches';
import { getBranchItems, listItemChanges } from '$lib/server/items';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) {
		throw redirect(302, '/api/auth/login');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role) {
		throw error(403, 'Access denied');
	}

	const project = await getProjectById(params.id);
	if (!project) {
		throw error(404, 'Project not found');
	}

	const branchId = url.searchParams.get('branch');
	const branch = branchId
		? await getBranchById(params.id, branchId)
		: await getDefaultBranch(params.id);

	if (!branch) {
		throw error(404, 'Branch not found');
	}

	const [items, changes] = await Promise.all([
		getBranchItems(params.id, branch.id),
		listItemChanges(params.id, branch.id, 200, 0)
	]);

	return {
		project: { id: project.id, name: project.name },
		branchId: branch.id,
		items: items.map((item) => ({ id: item.id, name: item.name })),
		changes
	};
};
