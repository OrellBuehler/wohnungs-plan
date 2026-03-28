import type { Item, CutoutCorner } from '$lib/types';

interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
}

/**
 * Generate polygon points for an L-shape
 * Returns flat array [x1, y1, x2, y2, ...] for Konva.Line
 * The L-shape is defined by outer bounds minus a cutout corner
 */
export function getLShapePoints(
	width: number,
	height: number,
	cutoutWidth: number,
	cutoutHeight: number,
	cutoutCorner: CutoutCorner
): number[] {
	// Ensure cutout doesn't exceed bounds
	const cw = Math.min(cutoutWidth, width - 1);
	const ch = Math.min(cutoutHeight, height - 1);

	switch (cutoutCorner) {
		case 'top-right':
			// L-shape with top-right corner cut out
			return [0, 0, width - cw, 0, width - cw, ch, width, ch, width, height, 0, height];
		case 'top-left':
			// L-shape with top-left corner cut out
			return [cw, 0, width, 0, width, height, 0, height, 0, ch, cw, ch];
		case 'bottom-right':
			// L-shape with bottom-right corner cut out
			return [
				0,
				0,
				width,
				0,
				width,
				height - ch,
				width - cw,
				height - ch,
				width - cw,
				height,
				0,
				height
			];
		case 'bottom-left':
			// L-shape with bottom-left corner cut out
			return [0, 0, width, 0, width, height, cw, height, cw, height - ch, 0, height - ch];
		default:
			return [0, 0, width, 0, width, height, 0, height];
	}
}

/**
 * Get rectangle points for Konva.Line (for consistency)
 */
export function getRectPoints(width: number, height: number): number[] {
	return [0, 0, width, 0, width, height, 0, height];
}

/**
 * Get shape points for any item
 */
export function getItemShapePoints(item: Item, scale: number): number[] {
	const w = item.width * scale;
	const h = item.height * scale;

	if (item.shape === 'l-shape' && item.cutoutWidth && item.cutoutHeight && item.cutoutCorner) {
		const cw = item.cutoutWidth * scale;
		const ch = item.cutoutHeight * scale;
		return getLShapePoints(w, h, cw, ch, item.cutoutCorner);
	}

	return getRectPoints(w, h);
}

/**
 * Get the axis-aligned bounding box for a rotated rectangle
 */
export function getRotatedBoundingBox(
	x: number,
	y: number,
	width: number,
	height: number,
	rotationDeg: number
): { minX: number; minY: number; maxX: number; maxY: number } {
	// If no rotation, simple case
	if (rotationDeg === 0) {
		return { minX: x, minY: y, maxX: x + width, maxY: y + height };
	}

	const rad = (rotationDeg * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);

	// Four corners of the rectangle (relative to origin)
	const corners = [
		{ x: 0, y: 0 },
		{ x: width, y: 0 },
		{ x: width, y: height },
		{ x: 0, y: height }
	];

	// Rotate each corner and find bounds
	let minX = Infinity,
		minY = Infinity,
		maxX = -Infinity,
		maxY = -Infinity;

	for (const corner of corners) {
		const rx = corner.x * cos - corner.y * sin + x;
		const ry = corner.x * sin + corner.y * cos + y;
		minX = Math.min(minX, rx);
		minY = Math.min(minY, ry);
		maxX = Math.max(maxX, rx);
		maxY = Math.max(maxY, ry);
	}

	return { minX, minY, maxX, maxY };
}

export interface BoundingBox {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

const DEFAULT_SPATIAL_CELL_SIZE = 128;
const MIN_SPATIAL_CELL_SIZE = 64;
const MAX_SPATIAL_CELL_SIZE = 512;

/**
 * Calculate minimum edge-to-edge distance between two bounding boxes
 * Returns the shortest distance and the two closest points
 */
export function getMinEdgeDistance(
	boxA: BoundingBox,
	boxB: BoundingBox
): { distance: number; pointA: { x: number; y: number }; pointB: { x: number; y: number } } {
	// Get all edges of both boxes
	const edgesA = [
		// Top edge
		{ start: { x: boxA.minX, y: boxA.minY }, end: { x: boxA.maxX, y: boxA.minY } },
		// Right edge
		{ start: { x: boxA.maxX, y: boxA.minY }, end: { x: boxA.maxX, y: boxA.maxY } },
		// Bottom edge
		{ start: { x: boxA.maxX, y: boxA.maxY }, end: { x: boxA.minX, y: boxA.maxY } },
		// Left edge
		{ start: { x: boxA.minX, y: boxA.maxY }, end: { x: boxA.minX, y: boxA.minY } }
	];

	const edgesB = [
		{ start: { x: boxB.minX, y: boxB.minY }, end: { x: boxB.maxX, y: boxB.minY } },
		{ start: { x: boxB.maxX, y: boxB.minY }, end: { x: boxB.maxX, y: boxB.maxY } },
		{ start: { x: boxB.maxX, y: boxB.maxY }, end: { x: boxB.minX, y: boxB.maxY } },
		{ start: { x: boxB.minX, y: boxB.maxY }, end: { x: boxB.minX, y: boxB.minY } }
	];

	let minDistance = Infinity;
	let closestPointA = { x: 0, y: 0 };
	let closestPointB = { x: 0, y: 0 };

	// Check distance from each edge of A to each edge of B
	for (const edgeA of edgesA) {
		for (const edgeB of edgesB) {
			// Check both endpoints of edgeA to edgeB
			const d1 = pointToSegmentDistance(edgeA.start, edgeB.start, edgeB.end);
			if (d1.distance < minDistance) {
				minDistance = d1.distance;
				closestPointA = edgeA.start;
				closestPointB = d1.closestPoint;
			}

			const d2 = pointToSegmentDistance(edgeA.end, edgeB.start, edgeB.end);
			if (d2.distance < minDistance) {
				minDistance = d2.distance;
				closestPointA = edgeA.end;
				closestPointB = d2.closestPoint;
			}

			// Check both endpoints of edgeB to edgeA
			const d3 = pointToSegmentDistance(edgeB.start, edgeA.start, edgeA.end);
			if (d3.distance < minDistance) {
				minDistance = d3.distance;
				closestPointA = d3.closestPoint;
				closestPointB = edgeB.start;
			}

			const d4 = pointToSegmentDistance(edgeB.end, edgeA.start, edgeA.end);
			if (d4.distance < minDistance) {
				minDistance = d4.distance;
				closestPointA = d4.closestPoint;
				closestPointB = edgeB.end;
			}
		}
	}

	return {
		distance: minDistance,
		pointA: closestPointA,
		pointB: closestPointB
	};
}

/**
 * Calculate distance from a point to a line segment
 */
function pointToSegmentDistance(
	point: { x: number; y: number },
	segStart: { x: number; y: number },
	segEnd: { x: number; y: number }
): { distance: number; closestPoint: { x: number; y: number } } {
	const dx = segEnd.x - segStart.x;
	const dy = segEnd.y - segStart.y;
	const lengthSquared = dx * dx + dy * dy;

	if (lengthSquared === 0) {
		// Segment is a point
		const dist = Math.sqrt((point.x - segStart.x) ** 2 + (point.y - segStart.y) ** 2);
		return { distance: dist, closestPoint: segStart };
	}

	// Find projection of point onto line (parameterized 0-1)
	let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lengthSquared;
	t = Math.max(0, Math.min(1, t)); // Clamp to segment

	const closestPoint = {
		x: segStart.x + t * dx,
		y: segStart.y + t * dy
	};

	const distance = Math.sqrt((point.x - closestPoint.x) ** 2 + (point.y - closestPoint.y) ** 2);

	return { distance, closestPoint };
}

function chooseSpatialCellSize(boxes: BoundingBox[]): number {
	if (boxes.length === 0) return DEFAULT_SPATIAL_CELL_SIZE;
	let sumLongestSide = 0;
	for (const box of boxes) {
		const width = Math.max(0, box.maxX - box.minX);
		const height = Math.max(0, box.maxY - box.minY);
		sumLongestSide += Math.max(width, height);
	}
	const average = sumLongestSide / boxes.length;
	return Math.max(MIN_SPATIAL_CELL_SIZE, Math.min(MAX_SPATIAL_CELL_SIZE, average));
}

export function collectPotentialOverlapPairs(
	boxes: BoundingBox[],
	cellSize = DEFAULT_SPATIAL_CELL_SIZE
): Array<[number, number]> {
	if (boxes.length < 2) return [];

	const size = Number.isFinite(cellSize) && cellSize > 0 ? cellSize : DEFAULT_SPATIAL_CELL_SIZE;
	const cellMap = new Map<string, number[]>();

	for (let i = 0; i < boxes.length; i++) {
		const box = boxes[i];
		const minCellX = Math.floor(box.minX / size);
		const maxCellX = Math.floor(box.maxX / size);
		const minCellY = Math.floor(box.minY / size);
		const maxCellY = Math.floor(box.maxY / size);

		for (let cx = minCellX; cx <= maxCellX; cx++) {
			for (let cy = minCellY; cy <= maxCellY; cy++) {
				const key = `${cx}:${cy}`;
				const bucket = cellMap.get(key);
				if (bucket) {
					bucket.push(i);
				} else {
					cellMap.set(key, [i]);
				}
			}
		}
	}

	const seenPairs = new Set<string>();
	const pairs: Array<[number, number]> = [];

	for (const bucket of cellMap.values()) {
		for (let a = 0; a < bucket.length; a++) {
			for (let b = a + 1; b < bucket.length; b++) {
				const ia = bucket[a];
				const ib = bucket[b];
				const low = ia < ib ? ia : ib;
				const high = ia < ib ? ib : ia;
				const key = `${low}:${high}`;
				if (seenPairs.has(key)) continue;
				seenPairs.add(key);
				pairs.push([low, high]);
			}
		}
	}

	return pairs;
}

export function selectNearestByDistance<T extends { distance: number }>(
	candidates: T[],
	limit: number
): T[] {
	if (limit <= 0 || candidates.length === 0) return [];

	const nearest: T[] = [];

	for (const candidate of candidates) {
		let insertAt = nearest.length;
		for (let i = 0; i < nearest.length; i++) {
			if (candidate.distance < nearest[i].distance) {
				insertAt = i;
				break;
			}
		}

		if (insertAt < limit) {
			nearest.splice(insertAt, 0, candidate);
			if (nearest.length > limit) {
				nearest.length = limit;
			}
		} else if (nearest.length < limit) {
			nearest.push(candidate);
		}
	}

	return nearest;
}

export function itemToRect(item: Item, scale: number): Rect | null {
	if (!item.position) return null;
	return {
		x: item.position.x,
		y: item.position.y,
		width: item.width * scale,
		height: item.height * scale,
		rotation: item.rotation
	};
}

// Minimum overlap in pixels required to be considered overlapping
const OVERLAP_TOLERANCE = 5;

export function getOverlappingItems(items: Item[], scale: number): Set<string> {
	const overlapping = new Set<string>();
	const placedItems = items.filter((item) => item.position !== null);
	const rects = placedItems.map((item) => ({ item, rect: itemToRect(item, scale)! }));
	const boxes = rects.map(({ rect }) =>
		getRotatedBoundingBox(rect.x, rect.y, rect.width, rect.height, rect.rotation)
	);
	const candidatePairs = collectPotentialOverlapPairs(boxes, chooseSpatialCellSize(boxes));

	for (const [i, j] of candidatePairs) {
		const boxA = boxes[i];
		const boxB = boxes[j];
		const overlapX = Math.min(boxA.maxX, boxB.maxX) - Math.max(boxA.minX, boxB.minX);
		const overlapY = Math.min(boxA.maxY, boxB.maxY) - Math.max(boxA.minY, boxB.minY);

		if (overlapX > OVERLAP_TOLERANCE && overlapY > OVERLAP_TOLERANCE) {
			overlapping.add(rects[i].item.id);
			overlapping.add(rects[j].item.id);
		}
	}

	return overlapping;
}

// ============================================================================
// Architectural Collision Detection (Walls, Doors, Windows)
// ============================================================================

import type { Wall, Door, Window } from '$lib/stores/project.svelte';

/**
 * Check if a rectangular item intersects with a wall (line segment)
 */
export function intersectsWall(
	itemX: number,
	itemY: number,
	itemWidth: number,
	itemHeight: number,
	wall: Wall
): boolean {
	const [x1, y1] = wall.start;
	const [x2, y2] = wall.end;

	// Item bounding box
	const rectLeft = itemX;
	const rectRight = itemX + itemWidth;
	const rectTop = itemY;
	const rectBottom = itemY + itemHeight;

	// Check if line segment intersects with rectangle
	return lineIntersectsRect(x1, y1, x2, y2, rectLeft, rectTop, rectRight, rectBottom);
}

/**
 * Check if a rectangular item blocks a door (overlaps with door swing area)
 *
 * Uses full circle check because door swing direction is not in the data model.
 * This is intentionally conservative — items near any side of a door hinge
 * will trigger a collision warning. To make this more precise, add a
 * `swing_angle` field to the Door type specifying the start angle of the 90° arc.
 */
export function blocksDoor(
	itemX: number,
	itemY: number,
	itemWidth: number,
	itemHeight: number,
	door: Door
): boolean {
	const doorRadius = door.width || 30;
	const [dx, dy] = door.position;

	return circleIntersectsRect(dx, dy, doorRadius, itemX, itemY, itemWidth, itemHeight);
}

/**
 * Check if a rectangular item blocks a window.
 * Infers window orientation from associated wall if available,
 * otherwise uses a square collision zone.
 */
export function blocksWindow(
	itemX: number,
	itemY: number,
	itemWidth: number,
	itemHeight: number,
	window: Window,
	walls?: Wall[]
): boolean {
	const windowWidth = window.width || 20;
	const [wx, wy] = window.position;
	const WINDOW_DEPTH = 10; // collision depth perpendicular to window

	let windowLeft: number;
	let windowRight: number;
	let windowTop: number;
	let windowBottom: number;

	// Try to infer orientation from associated wall
	const wall = walls && window.wall_id ? walls.find((w) => w.id === window.wall_id) : null;
	if (wall) {
		const dx = Math.abs(wall.end[0] - wall.start[0]);
		const dy = Math.abs(wall.end[1] - wall.start[1]);
		const isVerticalWall = dy > dx;

		if (isVerticalWall) {
			// Window on vertical wall: narrow in X, wide in Y
			windowLeft = wx - WINDOW_DEPTH / 2;
			windowRight = wx + WINDOW_DEPTH / 2;
			windowTop = wy - windowWidth / 2;
			windowBottom = wy + windowWidth / 2;
		} else {
			// Window on horizontal wall: wide in X, narrow in Y
			windowLeft = wx - windowWidth / 2;
			windowRight = wx + windowWidth / 2;
			windowTop = wy - WINDOW_DEPTH / 2;
			windowBottom = wy + WINDOW_DEPTH / 2;
		}
	} else {
		// No wall reference: use square zone as fallback
		const halfSize = windowWidth / 2;
		windowLeft = wx - halfSize;
		windowRight = wx + halfSize;
		windowTop = wy - halfSize;
		windowBottom = wy + halfSize;
	}

	const rectLeft = itemX;
	const rectRight = itemX + itemWidth;
	const rectTop = itemY;
	const rectBottom = itemY + itemHeight;

	return !(
		rectRight < windowLeft ||
		rectLeft > windowRight ||
		rectBottom < windowTop ||
		rectTop > windowBottom
	);
}

/**
 * Check if any walls are intersected by the item
 */
export function checkWallCollisions(
	itemX: number,
	itemY: number,
	itemWidth: number,
	itemHeight: number,
	walls: Wall[]
): boolean {
	return walls.some((wall) => intersectsWall(itemX, itemY, itemWidth, itemHeight, wall));
}

/**
 * Check if any doors are blocked by the item
 */
export function checkDoorCollisions(
	itemX: number,
	itemY: number,
	itemWidth: number,
	itemHeight: number,
	doors: Door[]
): boolean {
	return doors.some((door) => blocksDoor(itemX, itemY, itemWidth, itemHeight, door));
}

/**
 * Check if any windows are blocked by the item
 */
export function checkWindowCollisions(
	itemX: number,
	itemY: number,
	itemWidth: number,
	itemHeight: number,
	windows: Window[],
	walls?: Wall[]
): boolean {
	return windows.some((window) => blocksWindow(itemX, itemY, itemWidth, itemHeight, window, walls));
}

/**
 * Check if item has any architectural collisions (walls, doors, or windows)
 */
export function hasArchitecturalCollision(
	itemX: number,
	itemY: number,
	itemWidth: number,
	itemHeight: number,
	walls: Wall[],
	doors: Door[],
	windows: Window[]
): boolean {
	return (
		checkWallCollisions(itemX, itemY, itemWidth, itemHeight, walls) ||
		checkDoorCollisions(itemX, itemY, itemWidth, itemHeight, doors) ||
		checkWindowCollisions(itemX, itemY, itemWidth, itemHeight, windows, walls)
	);
}

// ============================================================================
// Internal helper functions for architectural collision
// ============================================================================

/**
 * Check if a line segment intersects with a rectangle
 */
function lineIntersectsRect(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	rectLeft: number,
	rectTop: number,
	rectRight: number,
	rectBottom: number
): boolean {
	// Check if either endpoint is inside the rectangle
	if (pointInRect(x1, y1, rectLeft, rectTop, rectRight, rectBottom)) return true;
	if (pointInRect(x2, y2, rectLeft, rectTop, rectRight, rectBottom)) return true;

	// Check if line intersects any of the rectangle's edges
	// Top edge
	if (lineIntersectsLine(x1, y1, x2, y2, rectLeft, rectTop, rectRight, rectTop)) return true;
	// Right edge
	if (lineIntersectsLine(x1, y1, x2, y2, rectRight, rectTop, rectRight, rectBottom)) return true;
	// Bottom edge
	if (lineIntersectsLine(x1, y1, x2, y2, rectLeft, rectBottom, rectRight, rectBottom)) return true;
	// Left edge
	if (lineIntersectsLine(x1, y1, x2, y2, rectLeft, rectTop, rectLeft, rectBottom)) return true;

	return false;
}

/**
 * Check if a point is inside a rectangle
 */
function pointInRect(
	px: number,
	py: number,
	rectLeft: number,
	rectTop: number,
	rectRight: number,
	rectBottom: number
): boolean {
	return px >= rectLeft && px <= rectRight && py >= rectTop && py <= rectBottom;
}

/**
 * Check if two line segments intersect
 */
function lineIntersectsLine(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	x3: number,
	y3: number,
	x4: number,
	y4: number
): boolean {
	// Calculate direction vectors
	const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);

	// Lines are parallel
	if (denom === 0) return false;

	const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
	const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

	// Intersection point is within both line segments
	return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

/**
 * Check if a circle intersects with a rectangle
 */
function circleIntersectsRect(
	cx: number,
	cy: number,
	radius: number,
	rectLeft: number,
	rectTop: number,
	rectWidth: number,
	rectHeight: number
): boolean {
	const rectRight = rectLeft + rectWidth;
	const rectBottom = rectTop + rectHeight;

	// Find closest point on rectangle to circle center
	const closestX = Math.max(rectLeft, Math.min(cx, rectRight));
	const closestY = Math.max(rectTop, Math.min(cy, rectBottom));

	// Calculate distance from circle center to closest point
	const distX = cx - closestX;
	const distY = cy - closestY;
	const distanceSquared = distX * distX + distY * distY;

	// Check if distance is less than radius
	return distanceSquared < radius * radius;
}
