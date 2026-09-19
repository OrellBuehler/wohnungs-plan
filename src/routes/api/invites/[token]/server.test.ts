import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './+server';

vi.mock('$lib/server/members', () => ({
	getInviteByToken: vi.fn(),
	acceptInvite: vi.fn()
}));

vi.mock('$lib/server/projects', () => ({
	getProjectById: vi.fn()
}));

import { getInviteByToken, acceptInvite } from '$lib/server/members';

function createEvent(user: { id: string; email?: string | null } | null) {
	const href = 'http://localhost:5173/api/invites/invite-token';
	return {
		request: new Request(href, { method: 'POST' }),
		locals: { user },
		params: { token: 'invite-token' },
		url: new URL(href),
		cookies: {
			get: () => undefined,
			getAll: () => [],
			set: () => {},
			delete: () => {},
			serialize: () => ''
		},
		fetch: globalThis.fetch,
		getClientAddress: () => '127.0.0.1',
		platform: {},
		isDataRequest: false,
		isSubRequest: false,
		route: { id: '' }
	} as any;
}

function mockInvite(email: string | null) {
	vi.mocked(getInviteByToken).mockResolvedValue({
		projectId: 'proj-1',
		email,
		role: 'editor',
		acceptedAt: null,
		expiresAt: new Date(Date.now() + 60_000)
	} as any);
}

describe('POST /api/invites/[token]', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 403 when the account has no email but the invite is email-bound', async () => {
		mockInvite('invited@example.com');
		await expect(POST(createEvent({ id: 'user-1', email: null }))).rejects.toMatchObject({
			status: 403
		});
		expect(acceptInvite).not.toHaveBeenCalled();
	});

	it('returns 403 when the account email does not match the invite', async () => {
		mockInvite('invited@example.com');
		await expect(
			POST(createEvent({ id: 'user-1', email: 'other@example.com' }))
		).rejects.toMatchObject({ status: 403 });
		expect(acceptInvite).not.toHaveBeenCalled();
	});

	it('accepts an invite for the matching account email', async () => {
		mockInvite('Invited@Example.com');
		const response = await POST(createEvent({ id: 'user-1', email: 'invited@example.com' }));
		expect(await response.json()).toEqual({ success: true, projectId: 'proj-1' });
		expect(acceptInvite).toHaveBeenCalled();
	});
});
