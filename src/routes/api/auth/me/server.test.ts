import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './+server';

// Mock server-side dependencies
vi.mock('$lib/server/session', () => ({
	parseSessionCookie: vi.fn(),
	getSessionWithUser: vi.fn()
}));

vi.mock('$lib/server/users', () => ({
	toUserProfile: vi.fn((user: any) => ({
		id: user.id,
		email: user.email,
		name: user.name,
		avatarUrl: user.avatarUrl
	}))
}));

import { parseSessionCookie, getSessionWithUser } from '$lib/server/session';
import { toUserProfile } from '$lib/server/users';

function createRequestEvent(cookieHeader?: string) {
	const headers = new Headers();
	if (cookieHeader) {
		headers.set('cookie', cookieHeader);
	}
	return {
		request: new Request('http://localhost:5173/api/auth/me', { headers }),
		locals: {},
		params: {},
		url: new URL('http://localhost:5173/api/auth/me'),
		cookies: { get: () => undefined, getAll: () => [], set: () => {}, delete: () => {}, serialize: () => '' },
		fetch: globalThis.fetch,
		getClientAddress: () => '127.0.0.1',
		platform: {},
		isDataRequest: false,
		isSubRequest: false,
		route: { id: '' }
	} as any;
}

describe('GET /api/auth/me', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns { user: null } when no session cookie', async () => {
		vi.mocked(parseSessionCookie).mockReturnValue(null);

		const response = await GET(createRequestEvent());
		const data = await response.json();
		expect(data).toEqual({ user: null });
	});

	it('returns { user: null } for invalid session', async () => {
		vi.mocked(parseSessionCookie).mockReturnValue('invalid-session');
		vi.mocked(getSessionWithUser).mockResolvedValue(null);

		const response = await GET(createRequestEvent('session=invalid-session'));
		const data = await response.json();
		expect(data).toEqual({ user: null });
	});

	it('returns user profile for valid session', async () => {
		const mockUser = {
			id: 'user-1',
			email: 'test@example.com',
			name: 'Test User',
			avatarUrl: null,
			infomaniakSub: '123',
			createdAt: new Date(),
			updatedAt: new Date()
		};
		vi.mocked(parseSessionCookie).mockReturnValue('valid-session');
		vi.mocked(getSessionWithUser).mockResolvedValue({
			session: {
				id: 'valid-session',
				userId: 'user-1',
				refreshToken: null,
				expiresAt: new Date(Date.now() + 86400000),
				createdAt: new Date()
			},
			user: mockUser
		});

		const response = await GET(createRequestEvent('session=valid-session'));
		const data = await response.json();
		expect(data.user).toEqual({
			id: 'user-1',
			email: 'test@example.com',
			name: 'Test User',
			avatarUrl: null
		});
		expect(toUserProfile).toHaveBeenCalledWith(mockUser);
	});
});
