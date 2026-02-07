import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole } from '$lib/server/projects';
import { createShareLink, getProjectShareLinks } from '$lib/server/share-links';

function toPublicShareLink(link: {
	id: string;
	token: string;
	label: string | null;
	expiresAt: Date | null;
	createdAt: Date | null;
	passwordHash: string | null;
}) {
	return {
		id: link.id,
		token: link.token,
		label: link.label,
		expiresAt: link.expiresAt,
		createdAt: link.createdAt,
		hasPassword: Boolean(link.passwordHash)
	};
}

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (role !== 'owner') {
		throw error(403, 'Owner access required');
	}

	const links = await getProjectShareLinks(params.id);
	return json({ links: links.map(toPublicShareLink) });
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const role = await getProjectRole(params.id, locals.user.id);
	if (role !== 'owner') {
		throw error(403, 'Owner access required');
	}

	const body = await request.json();
	const label = typeof body.label === 'string' ? body.label : undefined;
	const password = typeof body.password === 'string' ? body.password : undefined;
	const expiresAt = body.expiresAt ?? undefined;

	const link = await createShareLink(params.id, locals.user.id, { label, password, expiresAt });
	return json({ link: toPublicShareLink(link) }, { status: 201 });
};
