import { describe, it, expect } from 'vitest';
import {
	getItemsInRoom,
	getRoomAvailableSpace,
	checkPlacement,
	getItemRoom,
	suggestPlacement
} from './spatial-queries';
import type { FloorplanAnalysisData } from './floorplan-analyses';
import type { Item } from './db';

function makeItem(overrides: Partial<Item> = {}): Item {
	return {
		id: 'item-1',
		projectId: 'proj-1',
		branchId: 'branch-1',
		name: 'Test Item',
		width: 100,
		height: 50,
		x: 200,
		y: 200,
		rotation: 0,
		color: '#3b82f6',
		price: null,
		priceCurrency: 'EUR',
		productUrl: null,
		shape: 'rectangle',
		cutoutWidth: null,
		cutoutHeight: null,
		cutoutCorner: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides
	};
}

const analysis: FloorplanAnalysisData = {
	rooms: [
		{
			id: 'room-1',
			type: 'living_room',
			polygon: [
				[0, 0],
				[500, 0],
				[500, 400],
				[0, 400]
			],
			label: 'Living Room'
		},
		{
			id: 'room-2',
			type: 'bedroom',
			polygon: [
				[500, 0],
				[900, 0],
				[900, 400],
				[500, 400]
			],
			label: 'Bedroom'
		}
	],
	walls: [
		{ id: 'wall-1', start: [0, 0], end: [500, 0], thickness: 10 },
		{ id: 'wall-2', start: [500, 0], end: [500, 400], thickness: 10 }
	],
	openings: [{ id: 'door-1', type: 'door', position: [250, 0], width: 80 }],
	scale: { pixels_per_meter: 50 }
};

describe('getItemRoom', () => {
	it('identifies room for placed item', () => {
		const item = makeItem({ x: 200, y: 200 });
		expect(getItemRoom(item, analysis)).toBe('room-1');
	});

	it('returns null for unplaced item', () => {
		const item = makeItem({ x: null, y: null });
		expect(getItemRoom(item, analysis)).toBeNull();
	});

	it('identifies second room', () => {
		const item = makeItem({ x: 600, y: 200 });
		expect(getItemRoom(item, analysis)).toBe('room-2');
	});
});

describe('getItemsInRoom', () => {
	it('filters items by room', () => {
		const items = [
			makeItem({ id: 'a', x: 100, y: 100 }),
			makeItem({ id: 'b', x: 600, y: 100 }),
			makeItem({ id: 'c', x: null, y: null })
		];
		const result = getItemsInRoom('room-1', items, analysis);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('a');
	});
});

describe('getRoomAvailableSpace', () => {
	it('calculates free space', () => {
		const items = [makeItem({ x: 100, y: 100, width: 100, height: 50 })];
		const result = getRoomAvailableSpace('room-1', items, analysis);
		expect(result).not.toBeNull();
		expect(result!.total_area_px).toBe(200000); // 500*400
		expect(result!.used_area_px).toBe(5000); // 100*50
		expect(result!.free_area_px).toBe(195000);
		// With scale 50 px/m: 200000 / 2500 = 80 sqm
		expect(result!.total_area_sqm).toBe(80);
	});

	it('returns null for unknown room', () => {
		expect(getRoomAvailableSpace('nonexistent', [], analysis)).toBeNull();
	});
});

describe('checkPlacement', () => {
	it('valid placement in empty room', () => {
		const result = checkPlacement(200, 200, 100, 50, 0, [], analysis);
		expect(result.valid).toBe(true);
		expect(result.issues).toHaveLength(0);
		expect(result.room_id).toBe('room-1');
	});

	it('detects wall collision', () => {
		// Place item so top edge is at y=-5, touching wall at y=0 (threshold = 10/2 + 5 = 10)
		const result = checkPlacement(200, -5, 100, 50, 0, [], analysis);
		expect(result.wall_collisions.length).toBeGreaterThan(0);
		expect(result.valid).toBe(false);
	});

	it('detects door swing collision', () => {
		// Place item near door at (250, 0), door radius = 80 + 10 = 90
		const result = checkPlacement(210, -5, 100, 50, 0, [], analysis);
		expect(result.door_collisions.length).toBeGreaterThan(0);
	});

	it('detects item-item collision', () => {
		const existing = [makeItem({ id: 'other', x: 210, y: 210, width: 100, height: 50 })];
		const result = checkPlacement(200, 200, 100, 50, 0, existing, analysis);
		expect(result.item_collisions).toContain('other');
		expect(result.valid).toBe(false);
	});

	it('works without floorplan analysis', () => {
		const result = checkPlacement(200, 200, 100, 50, 0, [], null);
		expect(result.valid).toBe(true);
		expect(result.room_id).toBeNull();
	});
});

describe('suggestPlacement', () => {
	it('finds valid position in empty room', () => {
		const result = suggestPlacement('room-1', 100, 50, [], analysis, 20);
		expect(result).not.toBeNull();
		expect(result!.x).toBeGreaterThanOrEqual(0);
		expect(result!.y).toBeGreaterThanOrEqual(0);
	});

	it('returns null for unknown room', () => {
		expect(suggestPlacement('nonexistent', 100, 50, [], analysis)).toBeNull();
	});

	it('returns null when room is too small', () => {
		const tinyAnalysis: FloorplanAnalysisData = {
			rooms: [
				{
					id: 'tiny',
					type: 'closet',
					polygon: [
						[0, 0],
						[30, 0],
						[30, 30],
						[0, 30]
					]
				}
			],
			walls: [
				{ id: 'w1', start: [0, 0], end: [30, 0], thickness: 10 },
				{ id: 'w2', start: [30, 0], end: [30, 30], thickness: 10 },
				{ id: 'w3', start: [30, 30], end: [0, 30], thickness: 10 },
				{ id: 'w4', start: [0, 30], end: [0, 0], thickness: 10 }
			],
			openings: []
		};
		expect(suggestPlacement('tiny', 100, 50, [], tinyAnalysis)).toBeNull();
	});
});
