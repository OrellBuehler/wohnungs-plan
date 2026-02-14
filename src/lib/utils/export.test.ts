import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportProjectToJSON, importProjectFromJSON } from './export';
import type { Project } from '$lib/types';

function makeProject(overrides: Partial<Project> = {}): Project {
	return {
		id: 'proj-1',
		name: 'Test Project',
		createdAt: '2024-01-01T00:00:00Z',
		updatedAt: '2024-01-01T00:00:00Z',
		floorplan: null,
		items: [
			{
				id: 'item-1',
				name: 'Sofa',
				width: 200,
				height: 100,
				color: '#ff0000',
				price: 599,
				priceCurrency: 'EUR',
				productUrl: null,
				position: { x: 10, y: 20 },
				rotation: 0,
				shape: 'rectangle'
			}
		],
		currency: 'EUR',
		gridSize: 50,
		...overrides
	};
}

describe('exportProjectToJSON', () => {
	it('serializes project to JSON string', () => {
		const project = makeProject();
		const json = exportProjectToJSON(project);
		const parsed = JSON.parse(json);
		expect(parsed.id).toBe('proj-1');
		expect(parsed.name).toBe('Test Project');
		expect(parsed.items).toHaveLength(1);
	});

	it('includes thumbnail when provided', () => {
		const project = makeProject();
		const json = exportProjectToJSON(project, 'data:image/png;base64,abc');
		const parsed = JSON.parse(json);
		expect(parsed.thumbnail).toBe('data:image/png;base64,abc');
	});

	it('sets thumbnail to null when not provided', () => {
		const project = makeProject();
		const json = exportProjectToJSON(project);
		const parsed = JSON.parse(json);
		expect(parsed.thumbnail).toBeNull();
	});

	it('sets thumbnail to null when undefined', () => {
		const project = makeProject();
		const json = exportProjectToJSON(project, undefined);
		const parsed = JSON.parse(json);
		expect(parsed.thumbnail).toBeNull();
	});
});

describe('importProjectFromJSON', () => {
	it('imports a valid project JSON', () => {
		const project = makeProject();
		const json = exportProjectToJSON(project);
		const { project: imported, thumbnail } = importProjectFromJSON(json);
		expect(imported).not.toBeNull();
		expect(imported!.name).toBe('Test Project');
		expect(imported!.items).toHaveLength(1);
		expect(thumbnail).toBeNull();
	});

	it('assigns a new ID on import', () => {
		const project = makeProject();
		const json = exportProjectToJSON(project);
		const { project: imported } = importProjectFromJSON(json);
		expect(imported!.id).not.toBe('proj-1');
	});

	it('extracts thumbnail from JSON', () => {
		const project = makeProject();
		const json = exportProjectToJSON(project, 'data:image/png;base64,abc');
		const { thumbnail } = importProjectFromJSON(json);
		expect(thumbnail).toBe('data:image/png;base64,abc');
	});

	it('adds default currency if missing', () => {
		const data = { id: 'p1', name: 'Test', items: [] };
		const json = JSON.stringify(data);
		const { project } = importProjectFromJSON(json);
		expect(project!.currency).toBe('EUR');
	});

	it('adds default gridSize if missing', () => {
		const data = { id: 'p1', name: 'Test', items: [] };
		const json = JSON.stringify(data);
		const { project } = importProjectFromJSON(json);
		expect(project!.gridSize).toBe(50);
	});

	it('adds default shape to items if missing', () => {
		const data = {
			id: 'p1',
			name: 'Test',
			items: [{ id: 'i1', name: 'Chair', width: 50, height: 50, color: '#000', price: null, priceCurrency: 'EUR', productUrl: null, position: null, rotation: 0 }]
		};
		const json = JSON.stringify(data);
		const { project } = importProjectFromJSON(json);
		expect(project!.items[0].shape).toBe('rectangle');
	});

	it('adds default priceCurrency to items if missing', () => {
		const data = {
			id: 'p1',
			name: 'Test',
			currency: 'USD',
			items: [{ id: 'i1', name: 'Chair', width: 50, height: 50, color: '#000', price: null, productUrl: null, position: null, rotation: 0 }]
		};
		const json = JSON.stringify(data);
		const { project } = importProjectFromJSON(json);
		expect(project!.items[0].priceCurrency).toBe('USD');
	});

	it('returns null for invalid JSON', () => {
		const { project, thumbnail } = importProjectFromJSON('not json');
		expect(project).toBeNull();
		expect(thumbnail).toBeNull();
	});

	it('returns null for missing required fields (no id)', () => {
		const { project } = importProjectFromJSON(JSON.stringify({ name: 'Test', items: [] }));
		expect(project).toBeNull();
	});

	it('returns null for missing required fields (no name)', () => {
		const { project } = importProjectFromJSON(JSON.stringify({ id: '1', items: [] }));
		expect(project).toBeNull();
	});

	it('returns null for missing required fields (no items array)', () => {
		const { project } = importProjectFromJSON(JSON.stringify({ id: '1', name: 'T' }));
		expect(project).toBeNull();
	});
});
