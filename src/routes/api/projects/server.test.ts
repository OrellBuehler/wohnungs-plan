import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './+server';

// Mock DB functions
vi.mock('$lib/server/projects', () => ({
	getUserProjectsWithDetails: vi.fn(),
	createProject: vi.fn()
}));

import { getUserProjectsWithDetails, createProject } from '$lib/server/projects';

function createEvent(
	options: {
		method?: string;
		user?: { id: string } | null;
		body?: unknown;
	} = {}
) {
	const { method = 'GET', user = null, body } = options;
	const headers = new Headers();
	if (body) headers.set('content-type', 'application/json');

	return {
		request: new Request('http://localhost:5173/api/projects', {
			method,
			headers,
			...(body ? { body: JSON.stringify(body) } : {})
		}),
		locals: { user },
		params: {},
		url: new URL('http://localhost:5173/api/projects'),
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

describe('GET /api/projects', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 401 for unauthenticated user', async () => {
		await expect(GET(createEvent({ user: null }))).rejects.toThrow();
	});

	it('returns projects for authenticated user', async () => {
		const mockProjects = [
			{ id: 'p1', name: 'Project 1' },
			{ id: 'p2', name: 'Project 2' }
		];
		vi.mocked(getUserProjectsWithDetails).mockResolvedValue(mockProjects as any);

		const response = await GET(createEvent({ user: { id: 'user-1' } }));
		const data = await response.json();
		expect(data.projects).toEqual(mockProjects);
		expect(getUserProjectsWithDetails).toHaveBeenCalledWith('user-1');
	});
});

describe('POST /api/projects', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 401 for unauthenticated user', async () => {
		await expect(
			POST(createEvent({ method: 'POST', user: null, body: { name: 'Test' } }))
		).rejects.toThrow();
	});

	it('creates project with valid input', async () => {
		const mockProject = { id: 'p1', name: 'My Project' };
		vi.mocked(createProject).mockResolvedValue(mockProject as any);

		const response = await POST(
			createEvent({
				method: 'POST',
				user: { id: 'user-1' },
				body: { name: 'My Project', currency: 'EUR', gridSize: 50 }
			})
		);
		const data = await response.json();
		expect(response.status).toBe(201);
		expect(data.project).toEqual(mockProject);
		expect(createProject).toHaveBeenCalledWith('user-1', 'My Project', 'EUR', 50, undefined);
	});

	it('returns 400 for missing name', async () => {
		await expect(
			POST(
				createEvent({
					method: 'POST',
					user: { id: 'user-1' },
					body: { currency: 'EUR' }
				})
			)
		).rejects.toThrow();
	});

	it('returns 400 for non-string name', async () => {
		await expect(
			POST(
				createEvent({
					method: 'POST',
					user: { id: 'user-1' },
					body: { name: 123 }
				})
			)
		).rejects.toThrow();
	});
});
