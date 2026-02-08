import type { Project, Item, ProjectBranch } from '$lib/types';

/**
 * Creates a test Project with sensible defaults
 */
export function createTestProject(overrides?: Partial<Project>): Project {
	const id = overrides?.id ?? crypto.randomUUID();
	const now = new Date().toISOString();

	return {
		id,
		name: 'Test Project',
		createdAt: now,
		updatedAt: now,
		floorplan: null,
		items: [],
		currency: 'USD',
		gridSize: 20,
		isLocal: false,
		...overrides
	};
}

/**
 * Creates a test Item with sensible defaults
 */
export function createTestItem(overrides?: Partial<Item>): Item {
	return {
		id: crypto.randomUUID(),
		name: 'Test Item',
		width: 100,
		height: 60,
		color: '#3b82f6',
		price: null,
		priceCurrency: 'USD',
		productUrl: null,
		position: null,
		rotation: 0,
		shape: 'rectangle',
		...overrides
	};
}

/**
 * Creates a test ProjectBranch with sensible defaults
 */
export function createTestBranch(overrides?: Partial<ProjectBranch>): ProjectBranch {
	const projectId = overrides?.projectId ?? crypto.randomUUID();
	const now = new Date().toISOString();

	return {
		id: crypto.randomUUID(),
		projectId,
		name: 'main',
		forkedFromId: null,
		createdBy: 'user-1',
		createdAt: now,
		...overrides
	};
}
