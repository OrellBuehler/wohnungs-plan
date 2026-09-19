import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './+server';

vi.mock('$lib/server/projects', () => ({
	getProjectRole: vi.fn(),
	getProjectFloorplan: vi.fn()
}));

vi.mock('$lib/server/share-links', () => ({
	getShareLinkByToken: vi.fn(),
	isShareLinkValid: vi.fn(() => true)
}));

vi.mock('$lib/server/thumbnails', () => ({
	getThumbnailPath: (projectId: string) => `/uploads/thumbnails/${projectId}.png`
}));

vi.mock('$lib/server/floorplans', () => ({
	getFloorplanPath: (projectId: string, filename: string) =>
		`/uploads/floorplans/${projectId}/${filename}`
}));

vi.mock('node:fs/promises', () => {
	const readFile = vi.fn();
	const stat = vi.fn();
	return { readFile, stat, default: { readFile, stat } };
});

import { getProjectRole, getProjectFloorplan } from '$lib/server/projects';
import { getShareLinkByToken } from '$lib/server/share-links';
import { readFile, stat } from 'node:fs/promises';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

const files: Record<string, string> = {};

function createEvent(
	options: { user?: { id: string } | null; token?: string; projectId?: string } = {}
) {
	const { user = null, token, projectId = PROJECT_ID } = options;
	const href = `http://localhost:5173/api/images/thumbnails/${projectId}${
		token ? `?token=${token}` : ''
	}`;

	return {
		request: new Request(href),
		locals: { user },
		params: { projectId },
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

describe('GET /api/images/thumbnails/[projectId]', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		for (const key of Object.keys(files)) delete files[key];
		files[`/uploads/thumbnails/${PROJECT_ID}.png`] = 'project-thumbnail';
		files['og-image.png'] = 'default-og-image';

		vi.mocked(readFile).mockImplementation(async (path: any) => {
			const key = Object.keys(files).find((k) => String(path).endsWith(k));
			if (!key) throw new Error('ENOENT');
			return Buffer.from(files[key]) as any;
		});
		vi.mocked(stat).mockImplementation(async (path: any) => {
			const key = Object.keys(files).find((k) => String(path).endsWith(k));
			if (!key) throw new Error('ENOENT');
			return { size: files[key].length } as any;
		});
		vi.mocked(getProjectRole).mockResolvedValue(null);
		vi.mocked(getProjectFloorplan).mockResolvedValue(null);
		vi.mocked(getShareLinkByToken).mockResolvedValue(undefined as any);
	});

	it('returns 400 for a non-UUID projectId', async () => {
		await expect(GET(createEvent({ projectId: 'not-a-uuid' }))).rejects.toMatchObject({
			status: 400
		});
	});

	it('serves the default OG image to anonymous users even when a thumbnail is cached', async () => {
		const response = await GET(createEvent());
		expect(await response.text()).toBe('default-og-image');
		expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400');
	});

	it('serves the default OG image when the user is not a project member', async () => {
		vi.mocked(getProjectRole).mockResolvedValue(null);
		const response = await GET(createEvent({ user: { id: 'outsider' } }));
		expect(await response.text()).toBe('default-og-image');
	});

	it('serves the cached thumbnail to a project member', async () => {
		vi.mocked(getProjectRole).mockResolvedValue('viewer');
		const response = await GET(createEvent({ user: { id: 'user-1' } }));
		expect(await response.text()).toBe('project-thumbnail');
		expect(response.headers.get('Cache-Control')).toBe('private, max-age=3600');
		expect(response.headers.get('Vary')).toBe('Cookie');
	});

	it('serves the cached thumbnail for a valid share token', async () => {
		vi.mocked(getShareLinkByToken).mockResolvedValue({
			projectId: PROJECT_ID,
			passwordHash: null
		} as any);
		const response = await GET(createEvent({ token: 'share-token' }));
		expect(await response.text()).toBe('project-thumbnail');
	});

	it('ignores a share token issued for another project', async () => {
		vi.mocked(getShareLinkByToken).mockResolvedValue({
			projectId: 'other-project',
			passwordHash: null
		} as any);
		const response = await GET(createEvent({ token: 'share-token' }));
		expect(await response.text()).toBe('default-og-image');
	});

	it('falls back to the floorplan for a member when no thumbnail is cached', async () => {
		delete files[`/uploads/thumbnails/${PROJECT_ID}.png`];
		files[`/uploads/floorplans/${PROJECT_ID}/plan.png`] = 'floorplan';
		vi.mocked(getProjectRole).mockResolvedValue('owner');
		vi.mocked(getProjectFloorplan).mockResolvedValue({
			filename: 'plan.png',
			mimeType: 'image/png'
		} as any);

		const response = await GET(createEvent({ user: { id: 'user-1' } }));
		expect(await response.text()).toBe('floorplan');
		expect(response.headers.get('Cache-Control')).toBe('private, max-age=60');
		expect(response.headers.get('Vary')).toBe('Cookie');
	});
});
