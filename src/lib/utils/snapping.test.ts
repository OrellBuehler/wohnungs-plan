import { describe, expect, it } from 'vitest';
import { computeSnap } from '#lib/utils/snapping.ts';

const box = (minX: number, minY: number, maxX: number, maxY: number) => ({
	minX,
	minY,
	maxX,
	maxY
});

describe('computeSnap', () => {
	it('snaps to the closest edge of another box and reports a guide', () => {
		const result = computeSnap({
			box: box(103, 300, 153, 350),
			others: [box(0, 0, 100, 100)],
			threshold: 5,
			grid: null
		});
		expect(result.dx).toBe(-3);
		expect(result.dy).toBe(0);
		expect(result.guides).toEqual([{ type: 'v', pos: 100 }]);
	});

	it('prefers the nearest alignment over the first match', () => {
		const result = computeSnap({
			box: box(104, 0, 154, 50),
			others: [box(0, 200, 100, 300), box(0, 400, 105, 500)],
			threshold: 5,
			grid: null
		});
		expect(result.dx).toBe(1);
		expect(result.guides).toEqual([{ type: 'v', pos: 105 }]);
	});

	it('falls back to the grid, snapping whichever edge is closer', () => {
		const grid = { originX: 10, originY: 10, step: 50 };
		const leading = computeSnap({ box: box(63, 12, 93, 42), others: [], threshold: 5, grid });
		expect(leading.dx).toBe(-3);
		expect(leading.dy).toBe(-2);

		const trailing = computeSnap({ box: box(75, 10, 108, 40), others: [], threshold: 5, grid });
		expect(trailing.dx).toBe(2);
	});

	it('keeps alignment on one axis and grid on the other', () => {
		const result = computeSnap({
			box: box(102, 37, 152, 87),
			others: [box(0, 500, 100, 600)],
			threshold: 5,
			grid: { originX: 0, originY: 0, step: 20 }
		});
		expect(result.dx).toBe(-2);
		expect(result.dy).toBe(3);
	});

	it('does not move without alignment or grid', () => {
		const result = computeSnap({
			box: box(40, 40, 60, 60),
			others: [box(200, 200, 300, 300)],
			threshold: 5,
			grid: null
		});
		expect(result).toEqual({ dx: 0, dy: 0, guides: [] });
	});
});
