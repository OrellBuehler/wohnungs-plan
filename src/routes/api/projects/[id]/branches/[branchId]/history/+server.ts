import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBranchById } from '$lib/server/branches';
import { listItemChanges } from '$lib/server/items';
import { getProjectRole } from '$lib/server/projects';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parsePositiveInt(value: string | null, fallback: number): number {
	if (!value) return fallback;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed < 0) return fallback;
	return parsed;
}

export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role) {
		throw error(403, 'Access denied');
	}

	const branch = await getBranchById(params.id, params.branchId);
	if (!branch) {
		throw error(404, 'Branch not found');
	}

	const limit = Math.min(parsePositiveInt(url.searchParams.get('limit'), DEFAULT_LIMIT), MAX_LIMIT);
	const offset = parsePositiveInt(url.searchParams.get('offset'), 0);
	const changes = await listItemChanges(params.id, params.branchId, limit, offset);
	return json({ changes, limit, offset });
};
