import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestProject, createTestBranch, createTestItem } from '$lib/test-utils/factories';

// Mock dependencies before importing
vi.mock('$lib/db', () => {
	const projects = new Map();
	return {
		getAllProjects: vi.fn(async () => Array.from(projects.values())),
		getProject: vi.fn(async (id: string) => projects.get(id)),
		saveProject: vi.fn(async (project: any) => {
			projects.set(project.id, { ...project, updatedAt: new Date().toISOString() });
		}),
		deleteProject: vi.fn(async (id: string) => projects.delete(id)),
		createNewProject: vi.fn(),
		saveThumbnail: vi.fn(),
		getThumbnail: vi.fn(async () => null),
		deleteThumbnail: vi.fn(),
		_projects: projects
	};
});

vi.mock('$lib/stores/auth.svelte', () => ({
	isAuthenticated: vi.fn(() => false),
	waitForAuth: vi.fn(() => Promise.resolve()),
	authFetch: vi.fn((...args: Parameters<typeof fetch>) => globalThis.fetch(...args))
}));

vi.mock('$lib/stores/sync.svelte', () => ({
	isOnline: vi.fn(() => true),
	queueChange: vi.fn()
}));

import {
	loadProjectById,
	setActiveBranch,
	setProject,
	getProject,
	addItem,
	updateItem,
	deleteItem
} from './project.svelte';
import * as authStore from '$lib/stores/auth.svelte';
import * as syncStore from '$lib/stores/sync.svelte';
import * as db from '$lib/db';

describe('project store - critical decision logic', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setProject(null);
		(authStore.isAuthenticated as any).mockReturnValue(false);
		(syncStore.isOnline as any).mockReturnValue(true);
		(globalThis.fetch as any).mockClear();
	});

	describe('loadProjectById - auth/online matrix', () => {
		it('authenticated + online → fetches from API', async () => {
			const project = createTestProject({ id: 'proj-1' });
			const branch = createTestBranch({ projectId: 'proj-1', id: 'branch-1' });

			(authStore.isAuthenticated as any).mockReturnValue(true);
			(syncStore.isOnline as any).mockReturnValue(true);

			(globalThis.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					project: {
						id: 'proj-1',
						name: project.name,
						createdAt: project.createdAt,
						updatedAt: project.updatedAt,
						currency: project.currency,
						gridSize: project.gridSize
					},
					items: [],
					floorplan: null,
					branches: [branch],
					activeBranchId: 'branch-1'
				})
			});

			const result = await loadProjectById('proj-1');

			expect(globalThis.fetch).toHaveBeenCalledWith('/api/projects/proj-1');
			expect(result?.isLocal).toBe(false);
		});

		it('NOT authenticated → returns local copy', async () => {
			const project = createTestProject({ id: 'proj-1' });
			(db.getProject as any).mockResolvedValueOnce(project);

			(authStore.isAuthenticated as any).mockReturnValue(false);

			const result = await loadProjectById('proj-1');

			expect(globalThis.fetch).not.toHaveBeenCalled();
			expect(result?.isLocal).toBe(true);
		});

		it('authenticated + offline → returns local copy', async () => {
			const project = createTestProject({ id: 'proj-1' });
			(db.getProject as any).mockResolvedValueOnce(project);

			(authStore.isAuthenticated as any).mockReturnValue(true);
			(syncStore.isOnline as any).mockReturnValue(false);

			const result = await loadProjectById('proj-1');

			expect(globalThis.fetch).not.toHaveBeenCalled();
			expect(result?.isLocal).toBe(true);
		});
	});

	describe('setActiveBranch - THE BUG TEST', () => {
		it('authenticated + online → fetches branch items from API (bug was skipping this)', async () => {
			const mainBranch = createTestBranch({ id: 'main-1', name: 'main' });
			const featureBranch = createTestBranch({ id: 'feature-1', name: 'feature' });
			const project = createTestProject({
				id: 'proj-1',
				branches: [mainBranch, featureBranch],
				activeBranchId: 'main-1'
			});

			setProject(project);

			(authStore.isAuthenticated as any).mockReturnValue(true);
			(syncStore.isOnline as any).mockReturnValue(true);

			const item1 = createTestItem({ name: 'Item 1' });
			(globalThis.fetch as any).mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					items: [
						{
							id: item1.id,
							name: item1.name,
							width: item1.width,
							height: item1.height,
							x: null,
							y: null,
							rotation: 0,
							color: item1.color,
							price: null,
							priceCurrency: 'USD',
							productUrl: null,
							shape: 'rectangle',
							cutoutWidth: null,
							cutoutHeight: null,
							cutoutCorner: null
						}
					]
				})
			});

			const success = await setActiveBranch('feature-1');

			// THIS IS THE CRITICAL ASSERTION - the bug caused this to NOT be called
			expect(globalThis.fetch).toHaveBeenCalledWith(
				'/api/projects/proj-1/branches/feature-1/items'
			);
			expect(success).toBe(true);
			expect(getProject()?.activeBranchId).toBe('feature-1');
			expect(getProject()?.isLocal).toBe(false);
			expect(getProject()?.items.length).toBe(1);
		});

		it('NOT authenticated → local-only branch switch (no API call)', async () => {
			const mainBranch = createTestBranch({ id: 'main-1' });
			const featureBranch = createTestBranch({ id: 'feature-1' });
			const project = createTestProject({
				id: 'proj-1',
				branches: [mainBranch, featureBranch],
				activeBranchId: 'main-1',
				items: [createTestItem()]
			});

			setProject(project);
			(authStore.isAuthenticated as any).mockReturnValue(false);

			const success = await setActiveBranch('feature-1');

			expect(globalThis.fetch).not.toHaveBeenCalled();
			expect(success).toBe(true);
			expect(getProject()?.activeBranchId).toBe('feature-1');
		});
	});

	describe('addItem - auth/online decision matrix', () => {
		it('authenticated + online → sends to API', () => {
			const branch = createTestBranch({ id: 'branch-1' });
			const project = createTestProject({
				id: 'proj-1',
				branches: [branch],
				activeBranchId: 'branch-1',
				isLocal: false
			});

			setProject(project);

			(authStore.isAuthenticated as any).mockReturnValue(true);
			(syncStore.isOnline as any).mockReturnValue(true);

			(globalThis.fetch as any).mockResolvedValueOnce({ ok: true });

			const newItem = createTestItem();
			const { id, ...itemWithoutId } = newItem;

			const result = addItem(itemWithoutId);

			expect(result).toBeTruthy();
			expect(globalThis.fetch).toHaveBeenCalledWith(
				'/api/projects/proj-1/branches/branch-1/items',
				expect.objectContaining({
					method: 'POST'
				})
			);
		});

		it('authenticated + offline → queues change', () => {
			const branch = createTestBranch({ id: 'branch-1' });
			const project = createTestProject({
				id: 'proj-1',
				branches: [branch],
				activeBranchId: 'branch-1',
				isLocal: false
			});

			setProject(project);

			(authStore.isAuthenticated as any).mockReturnValue(true);
			(syncStore.isOnline as any).mockReturnValue(false);

			const newItem = createTestItem();
			const { id, ...itemWithoutId } = newItem;

			const result = addItem(itemWithoutId);

			expect(result).toBeTruthy();
			expect(globalThis.fetch).not.toHaveBeenCalled();
			expect(syncStore.queueChange).toHaveBeenCalled();
		});

		it('NOT authenticated → local-only save', () => {
			const branch = createTestBranch({ id: 'branch-1' });
			const project = createTestProject({
				id: 'proj-1',
				branches: [branch],
				activeBranchId: 'branch-1',
				isLocal: true
			});

			setProject(project);
			(authStore.isAuthenticated as any).mockReturnValue(false);

			const newItem = createTestItem();
			const { id, ...itemWithoutId } = newItem;

			const result = addItem(itemWithoutId);

			expect(result).toBeTruthy();
			expect(globalThis.fetch).not.toHaveBeenCalled();
			expect(syncStore.queueChange).not.toHaveBeenCalled();
		});
	});
});
