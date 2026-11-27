import type { BoundingBox } from '#lib/utils/geometry.ts';

export interface SnapGuide {
	type: 'h' | 'v';
	pos: number;
}

export interface SnapGrid {
	originX: number;
	originY: number;
	step: number;
}

export interface SnapInput {
	box: BoundingBox;
	others: BoundingBox[];
	threshold: number;
	grid: SnapGrid | null;
}

export interface SnapResult {
	dx: number;
	dy: number;
	guides: SnapGuide[];
}

const EPSILON = 1e-6;

function snapAxis(
	min: number,
	max: number,
	others: Array<[number, number]>,
	threshold: number,
	gridOrigin: number,
	gridStep: number | null
): { delta: number; guides: number[] } {
	const center = (min + max) / 2;
	let best: number | null = null;
	const candidates: Array<{ delta: number; pos: number }> = [];

	for (const [otherMin, otherMax] of others) {
		const pairs: Array<[number, number]> = [
			[min, otherMin],
			[min, otherMax],
			[max, otherMin],
			[max, otherMax],
			[center, (otherMin + otherMax) / 2]
		];
		for (const [own, target] of pairs) {
			const delta = target - own;
			if (Math.abs(delta) >= threshold) continue;
			candidates.push({ delta, pos: target });
			if (best === null || Math.abs(delta) < Math.abs(best)) best = delta;
		}
	}

	if (best !== null) {
		const chosen = best;
		const guides = new Set<number>();
		for (const candidate of candidates) {
			if (Math.abs(candidate.delta - chosen) < EPSILON) guides.add(candidate.pos);
		}
		return { delta: chosen, guides: [...guides] };
	}

	if (gridStep !== null && gridStep > 0) {
		const toGrid = (value: number) =>
			Math.round((value - gridOrigin) / gridStep) * gridStep + gridOrigin - value;
		const deltaMin = toGrid(min);
		const deltaMax = toGrid(max);
		return { delta: Math.abs(deltaMax) < Math.abs(deltaMin) ? deltaMax : deltaMin, guides: [] };
	}

	return { delta: 0, guides: [] };
}

/**
 * Offset that snaps a dragged bounding box to the edges and centers of
 * other boxes, falling back to the grid on axes without an alignment.
 */
export function computeSnap(input: SnapInput): SnapResult {
	const { box, others, threshold, grid } = input;
	const x = snapAxis(
		box.minX,
		box.maxX,
		others.map((o) => [o.minX, o.maxX]),
		threshold,
		grid?.originX ?? 0,
		grid?.step ?? null
	);
	const y = snapAxis(
		box.minY,
		box.maxY,
		others.map((o) => [o.minY, o.maxY]),
		threshold,
		grid?.originY ?? 0,
		grid?.step ?? null
	);

	return {
		dx: x.delta,
		dy: y.delta,
		guides: [
			...x.guides.map((pos) => ({ type: 'v' as const, pos })),
			...y.guides.map((pos) => ({ type: 'h' as const, pos }))
		]
	};
}
