import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH } from './+server';

vi.mock('$lib/server/projects', () => ({
	getProjectRole: vi.fn(),
	getProjectDisabledTools: vi.fn(),
	updateProjectDisabledTools: vi.fn()
}));

import {
	getProjectRole,
	getProjectDisabledTools,
	updateProjectDisabledTools
} from '$lib/server/projects';

function createEvent(options: {
	method?: string;
	user?: { id: string } | null;
	body?: unknown;
	projectId?: string;
} = {}) {
	const { method = 'GET', user = null, body, projectId = 'proj-1' } = options;
	const headers = new Headers();
	if (body) headers.set('content-type', 'application/json');

	return {
		request: new Request(`http://localhost:5173/api/projects/${projectId}/mcp-tools`, {
			method,
			headers,
			...(body ? { body: JSON.stringify(body) } : {})
		}),
		locals: { user },
		params: { id: projectId },
		url: new URL(`http://localhost:5173/api/projects/${projectId}/mcp-tools`),
		cookies: { get: () => undefined, getAll: () => [], set: () => {}, delete: () => {}, serialize: () => '' },
		fetch: globalThis.fetch,
		getClientAddress: () => '127.0.0.1',
		platform: {},
		isDataRequest: false,
		isSubRequest: false,
		route: { id: '' }
	} as any;
}

describe('GET /api/projects/[id]/mcp-tools', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 401 for unauthenticated user', async () => {
		await expect(GET(createEvent({ user: null }))).rejects.toThrow();
	});

	it('returns 403 when user has no project role', async () => {
		vi.mocked(getProjectRole).mockResolvedValue(null);
		await expect(GET(createEvent({ user: { id: 'user-1' } }))).rejects.toThrow();
	});

	it('returns disabled tools for viewer', async () => {
		vi.mocked(getProjectRole).mockResolvedValue('viewer');
		vi.mocked(getProjectDisabledTools).mockResolvedValue(['delete_furniture_item', 'create_branch']);

		const response = await GET(createEvent({ user: { id: 'user-1' } }));
		const data = await response.json();

		expect(data.disabledTools).toEqual(['delete_furniture_item', 'create_branch']);
		expect(getProjectDisabledTools).toHaveBeenCalledWith('proj-1');
	});

	it('returns empty array when no tools disabled', async () => {
		vi.mocked(getProjectRole).mockResolvedValue('editor');
		vi.mocked(getProjectDisabledTools).mockResolvedValue([]);

		const response = await GET(createEvent({ user: { id: 'user-1' } }));
		const data = await response.json();

		expect(data.disabledTools).toEqual([]);
	});
});

describe('PATCH /api/projects/[id]/mcp-tools', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 401 for unauthenticated user', async () => {
		await expect(
			PATCH(createEvent({ method: 'PATCH', user: null, body: { disabledTools: [] } }))
		).rejects.toThrow();
	});

	it('returns 403 for viewer', async () => {
		vi.mocked(getProjectRole).mockResolvedValue('viewer');
		await expect(
			PATCH(createEvent({ method: 'PATCH', user: { id: 'user-1' }, body: { disabledTools: [] } }))
		).rejects.toThrow();
	});

	it('returns 403 for editor', async () => {
		vi.mocked(getProjectRole).mockResolvedValue('editor');
		await expect(
			PATCH(createEvent({ method: 'PATCH', user: { id: 'user-1' }, body: { disabledTools: [] } }))
		).rejects.toThrow();
	});

	it('updates disabled tools for owner', async () => {
		vi.mocked(getProjectRole).mockResolvedValue('owner');
		vi.mocked(updateProjectDisabledTools).mockResolvedValue();

		const tools = ['delete_furniture_item', 'create_branch'];
		const response = await PATCH(
			createEvent({ method: 'PATCH', user: { id: 'user-1' }, body: { disabledTools: tools } })
		);
		const data = await response.json();

		expect(data.disabledTools).toEqual(tools);
		expect(updateProjectDisabledTools).toHaveBeenCalledWith('proj-1', tools);
	});

	it('returns 400 for non-array disabledTools', async () => {
		vi.mocked(getProjectRole).mockResolvedValue('owner');
		await expect(
			PATCH(createEvent({ method: 'PATCH', user: { id: 'user-1' }, body: { disabledTools: 'not-array' } }))
		).rejects.toThrow();
	});

	it('returns 400 for array with non-string elements', async () => {
		vi.mocked(getProjectRole).mockResolvedValue('owner');
		await expect(
			PATCH(createEvent({ method: 'PATCH', user: { id: 'user-1' }, body: { disabledTools: [123, true] } }))
		).rejects.toThrow();
	});

	it('accepts empty array to enable all tools', async () => {
		vi.mocked(getProjectRole).mockResolvedValue('owner');
		vi.mocked(updateProjectDisabledTools).mockResolvedValue();

		const response = await PATCH(
			createEvent({ method: 'PATCH', user: { id: 'user-1' }, body: { disabledTools: [] } })
		);
		const data = await response.json();

		expect(data.disabledTools).toEqual([]);
		expect(updateProjectDisabledTools).toHaveBeenCalledWith('proj-1', []);
	});
});
