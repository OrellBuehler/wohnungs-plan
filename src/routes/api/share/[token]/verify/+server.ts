import { dev } from '$app/env';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkRateLimit } from '#lib/server/rate-limit.ts';
import {
	createShareAuthCookie,
	getShareAuthCookieExpires,
	getShareAuthCookieName,
	getShareLinkByToken,
	isShareLinkValid,
	verifySharePassword
} from '#lib/server/share-links.ts';

export const POST: RequestHandler = async ({ params, request, cookies }) => {
	if (!checkRateLimit(params.token)) {
		return Response.json({ error: 'Too many attempts' }, { status: 429 });
	}

	const link = await getShareLinkByToken(params.token);
	if (!link || !isShareLinkValid(link)) {
		throw error(404, 'Share link not found');
	}

	if (!link.passwordHash) {
		return Response.json({ success: true });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid request body');
	}

	const password =
		typeof (body as Record<string, unknown>).password === 'string'
			? ((body as Record<string, unknown>).password as string)
			: '';
	if (!password) {
		throw error(400, 'Password is required');
	}

	const isValid = await verifySharePassword(link, password);
	if (!isValid) {
		return Response.json({ error: 'Invalid password' }, { status: 401 });
	}

	const cookieName = getShareAuthCookieName(link.token);
	const cookieValue = createShareAuthCookie(link.id, link.token);
	cookies.set(cookieName, cookieValue, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		expires: getShareAuthCookieExpires(link.expiresAt)
	});

	return Response.json({ success: true });
};
