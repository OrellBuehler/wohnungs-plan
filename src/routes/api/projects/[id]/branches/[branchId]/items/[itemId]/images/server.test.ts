import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './+server';

vi.mock('$lib/server/projects', () => ({
	getProjectRole: vi.fn()
}));

vi.mock('$lib/server/branches', () => ({
	getBranchById: vi.fn()
}));

vi.mock('$lib/server/items', () => ({
	getItemById: vi.fn(),
	insertHistoryEntries: vi.fn()
}));

vi.mock('$lib/server/item-images', () => ({
	getItemImages: vi.fn(),
	createItemImage: vi.fn(),
	saveItemImageFile: vi.fn(),
	generateThumbnail: vi.fn(),
	getItemImagePath: vi.fn(),
	getItemImageThumbPath: vi.fn()
}));

vi.mock('$lib/server/env', () => ({
	config: { uploads: { dir: '/uploads', maxImageSize: 5242880 } }
}));

vi.mock('node:fs/promises', () => {
	const unlink = vi.fn();
	return { unlink, default: { unlink } };
});

import { getProjectRole } from '$lib/server/projects';
import { getBranchById } from '$lib/server/branches';
import { getItemById } from '$lib/server/items';
import { getItemImages } from '$lib/server/item-images';

function createEvent(options: { user?: { id: string } | null } = {}) {
	const { user = { id: 'user-1' } } = options;
	const href = 'http://localhost:5173/api/projects/proj-1/branches/branch-1/items/item-1/images';

	return {
		request: new Request(href),
		locals: { user },
		params: { id: 'proj-1', branchId: 'branch-1', itemId: 'item-1' },
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

describe('GET /api/projects/[id]/branches/[branchId]/items/[itemId]/images', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getProjectRole).mockResolvedValue('owner');
		vi.mocked(getBranchById).mockResolvedValue({ id: 'branch-1' } as any);
		vi.mocked(getItemById).mockResolvedValue({ id: 'item-1' } as any);
		vi.mocked(getItemImages).mockResolvedValue([{ id: 'image-1' }] as any);
	});

	it('returns 401 for unauthenticated user', async () => {
		await expect(GET(createEvent({ user: null }))).rejects.toMatchObject({ status: 401 });
	});

	it('returns 403 when the user has no project role', async () => {
		vi.mocked(getProjectRole).mockResolvedValue(null);
		await expect(GET(createEvent())).rejects.toMatchObject({ status: 403 });
	});

	it('returns 404 when the branch does not belong to the project', async () => {
		vi.mocked(getBranchById).mockResolvedValue(undefined as any);
		await expect(GET(createEvent())).rejects.toMatchObject({ status: 404 });
		expect(getItemImages).not.toHaveBeenCalled();
	});

	it('returns 404 when the item does not belong to the branch', async () => {
		vi.mocked(getItemById).mockResolvedValue(undefined as any);
		await expect(GET(createEvent())).rejects.toMatchObject({ status: 404 });
		expect(getItemImages).not.toHaveBeenCalled();
	});

	it('returns the images when branch and item belong to the project', async () => {
		const response = await GET(createEvent());
		const data = await response.json();
		expect(data.images).toEqual([{ id: 'image-1' }]);
		expect(getItemById).toHaveBeenCalledWith('proj-1', 'branch-1', 'item-1');
	});
});
