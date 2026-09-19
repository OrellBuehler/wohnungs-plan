import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'node:path';
import { GET } from './+server';

vi.mock('$lib/server/projects', () => ({
	getProjectRole: vi.fn()
}));

vi.mock('$lib/server/item-images', () => ({
	getItemImageByFilename: vi.fn(),
	getItemImagePath: (projectId: string, itemId: string, filename: string) =>
		join('/uploads', 'item-images', projectId, itemId, filename),
	getItemImageThumbPath: (projectId: string, itemId: string, filename: string) =>
		join('/uploads', 'item-images', projectId, itemId, `thumb_${filename}`)
}));

vi.mock('$lib/server/env', () => ({
	config: { uploads: { dir: '/uploads' } }
}));

vi.mock('node:fs/promises', () => {
	const readFile = vi.fn();
	const stat = vi.fn();
	return { readFile, stat, default: { readFile, stat } };
});

import { getProjectRole } from '$lib/server/projects';
import { getItemImageByFilename } from '$lib/server/item-images';
import { readFile, stat } from 'node:fs/promises';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const ITEM_ID = '22222222-2222-4222-8222-222222222222';
const FILENAME = '33333333-3333-4333-8333-333333333333.png';

function createEvent(
	options: {
		user?: { id: string } | null;
		projectId?: string;
		itemId?: string;
		filename?: string;
		thumb?: boolean;
	} = {}
) {
	const {
		user = { id: 'user-1' },
		projectId = PROJECT_ID,
		itemId = ITEM_ID,
		filename = FILENAME,
		thumb = false
	} = options;
	const href = `http://localhost:5173/api/images/items/${projectId}/${itemId}/${filename}${
		thumb ? '?thumb=1' : ''
	}`;

	return {
		request: new Request(href),
		locals: { user },
		params: { projectId, itemId, filename },
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

function expectStatus(promise: Promise<unknown>, status: number) {
	return expect(promise).rejects.toMatchObject({ status });
}

describe('GET /api/images/items/[projectId]/[itemId]/[filename]', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getProjectRole).mockResolvedValue('owner');
		vi.mocked(getItemImageByFilename).mockResolvedValue({
			filename: FILENAME,
			mimeType: 'image/png'
		} as any);
		vi.mocked(readFile).mockResolvedValue(Buffer.from('image-bytes') as any);
		vi.mocked(stat).mockResolvedValue({ size: 11 } as any);
	});

	it('returns 401 for unauthenticated user', async () => {
		await expectStatus(GET(createEvent({ user: null })), 401);
	});

	it('returns 400 when itemId escapes the directory via an encoded traversal', async () => {
		await expectStatus(GET(createEvent({ itemId: '../../thumbnails' })), 400);
		expect(readFile).not.toHaveBeenCalled();
	});

	it('returns 400 for a non-UUID projectId', async () => {
		await expectStatus(GET(createEvent({ projectId: '..' })), 400);
		expect(readFile).not.toHaveBeenCalled();
	});

	it('returns 400 for an invalid filename', async () => {
		await expectStatus(GET(createEvent({ filename: 'secret.txt' })), 400);
		expect(readFile).not.toHaveBeenCalled();
	});

	it('returns 403 when the user has no project role', async () => {
		vi.mocked(getProjectRole).mockResolvedValue(null);
		await expectStatus(GET(createEvent()), 403);
	});

	it('returns 404 when the filename is not registered for the item', async () => {
		vi.mocked(getItemImageByFilename).mockResolvedValue(null);
		await expectStatus(GET(createEvent()), 404);
		expect(readFile).not.toHaveBeenCalled();
	});

	it('returns 400 when the resolved path leaves the uploads directory', async () => {
		vi.mocked(getItemImageByFilename).mockResolvedValue({
			filename: '../../../../etc/passwd',
			mimeType: 'image/png'
		} as any);
		await expectStatus(GET(createEvent()), 400);
		expect(readFile).not.toHaveBeenCalled();
	});

	it('serves a registered image', async () => {
		const response = await GET(createEvent());
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('image/png');
		expect(readFile).toHaveBeenCalledWith(
			join('/uploads', 'item-images', PROJECT_ID, ITEM_ID, FILENAME)
		);
	});

	it('serves the thumbnail variant', async () => {
		const response = await GET(createEvent({ thumb: true }));
		expect(response.headers.get('Content-Type')).toBe('image/jpeg');
		expect(readFile).toHaveBeenCalledWith(
			join('/uploads', 'item-images', PROJECT_ID, ITEM_ID, `thumb_${FILENAME}`)
		);
	});
});
