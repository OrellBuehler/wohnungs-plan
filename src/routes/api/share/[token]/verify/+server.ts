import { dev } from '$app/environment';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkRateLimit } from '$lib/server/rate-limit';
import {
	createShareAuthCookie,
	getShareAuthCookieExpires,
	getShareAuthCookieName,
	getShareLinkByToken,
	isShareLinkValid,
	verifySharePassword
} from '$lib/server/share-links';

export const POST: RequestHandler = async ({ params, request, cookies }) => {
	if (!checkRateLimit(params.token)) {
		return json({ error: 'Too many attempts' }, { status: 429 });
	}

	const link = await getShareLinkByToken(params.token);
	if (!link || !isShareLinkValid(link)) {
		throw error(404, 'Share link not found');
	}

	if (!link.passwordHash) {
		return json({ success: true });
	}

	const body = await request.json();
	const password = typeof body.password === 'string' ? body.password : '';
	if (!password) {
		throw error(400, 'Password is required');
	}

	const isValid = await verifySharePassword(link, password);
	if (!isValid) {
		return json({ error: 'Invalid password' }, { status: 401 });
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

	return json({ success: true });
};
