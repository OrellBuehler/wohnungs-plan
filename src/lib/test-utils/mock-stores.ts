import { vi } from 'vitest';
import type { Project } from '$lib/types';

/**
 * Mock for $lib/stores/auth.svelte
 *
 * Usage:
 * ```ts
 * vi.mock('$lib/stores/auth.svelte', () => ({
 *   isAuthenticated: vi.fn(() => false),
 *   waitForAuth: vi.fn(() => Promise.resolve())
 * }));
 * ```
 */
export function createMockAuthStore(authenticated = false) {
	let authReady = false;
	let authReadyResolve: (() => void) | null = null;
	const authReadyPromise = new Promise<void>((resolve) => {
		authReadyResolve = resolve;
	});

	return {
		isAuthenticated: vi.fn(() => authenticated),
		isLoading: vi.fn(() => !authReady),
		getUser: vi.fn(() => (authenticated ? { id: 'user-1', email: 'test@example.com' } : null)),
		fetchUser: vi.fn(async () => {
			authReady = true;
			authReadyResolve?.();
		}),
		waitForAuth: vi.fn(() => authReadyPromise),
		logout: vi.fn()
	};
}

/**
 * Mock for $lib/stores/sync.svelte
 *
 * Usage:
 * ```ts
 * const syncMock = createMockSyncStore(true);
 * vi.mock('$lib/stores/sync.svelte', () => syncMock);
 * ```
 */
export function createMockSyncStore(online = true) {
	const changeQueue: unknown[] = [];

	return {
		isOnline: vi.fn(() => online),
		setOnline: vi.fn((value: boolean) => {
			online = value;
		}),
		queueChange: vi.fn((change: unknown) => {
			changeQueue.push(change);
		}),
		getPendingChanges: vi.fn(() => changeQueue.length),
		getSyncState: vi.fn(() => ({
			isOnline: online,
			isSyncing: false,
			pendingChanges: changeQueue.length,
			lastSynced: null,
			error: null
		}))
	};
}

/**
 * Mock for $lib/db (IndexedDB operations)
 *
 * Uses an in-memory Map to simulate IndexedDB storage.
 *
 * Usage:
 * ```ts
 * const dbMock = createMockDb();
 * vi.mock('$lib/db', () => dbMock);
 * ```
 */
export function createMockDb() {
	const projects = new Map<string, Project>();
	const thumbnails = new Map<string, string>();

	return {
		getAllProjects: vi.fn(async () => {
			return Array.from(projects.values()).map((p) => ({
				id: p.id,
				name: p.name,
				createdAt: p.createdAt,
				updatedAt: p.updatedAt,
				isLocal: true,
				thumbnailUrl: null,
				floorplanUrl: null,
				memberCount: 0
			}));
		}),
		getProject: vi.fn(async (id: string) => {
			return projects.get(id);
		}),
		saveProject: vi.fn(async (project: Project) => {
			projects.set(project.id, {
				...project,
				updatedAt: new Date().toISOString()
			});
		}),
		deleteProject: vi.fn(async (id: string) => {
			projects.delete(id);
			thumbnails.delete(id);
		}),
		createNewProject: vi.fn((name = 'Untitled Project') => {
			const now = new Date().toISOString();
			const projectId = crypto.randomUUID();
			const mainBranchId = crypto.randomUUID();
			return {
				id: projectId,
				name,
				createdAt: now,
				updatedAt: now,
				floorplan: null,
				items: [],
				branches: [
					{
						id: mainBranchId,
						projectId,
						name: 'Main',
						forkedFromId: null,
						createdBy: 'local',
						createdAt: now
					}
				],
				activeBranchId: mainBranchId,
				currency: 'USD' as const,
				gridSize: 50,
				isLocal: true
			};
		}),
		saveThumbnail: vi.fn(async (projectId: string, dataUrl: string) => {
			thumbnails.set(projectId, dataUrl);
		}),
		getThumbnail: vi.fn(async (projectId: string) => {
			return thumbnails.get(projectId) ?? null;
		}),
		deleteThumbnail: vi.fn(async (projectId: string) => {
			thumbnails.delete(projectId);
		}),
		// Expose the Map for test assertions
		_projects: projects,
		_thumbnails: thumbnails
	};
}
