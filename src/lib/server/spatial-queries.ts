import type { FloorplanAnalysisData } from './floorplan-analyses';
import type { Item } from './db';

type Point = [number, number];

/** Check if point is inside polygon using ray-casting algorithm */
function pointInPolygon(point: Point, polygon: Point[]): boolean {
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const xi = polygon[i][0],
			yi = polygon[i][1];
		const xj = polygon[j][0],
			yj = polygon[j][1];
		const intersect =
			yi > point[1] !== yj > point[1] &&
			point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
		if (intersect) inside = !inside;
	}
	return inside;
}

/** Get bounding box of an item accounting for rotation */
function getItemBounds(item: Item): { corners: Point[] } | null {
	if (item.x === null || item.y === null) return null;
	const cx = item.x + item.width / 2;
	const cy = item.y + item.height / 2;
	const rad = ((item.rotation ?? 0) * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);

	const hw = item.width / 2;
	const hh = item.height / 2;
	const offsets: Point[] = [
		[-hw, -hh],
		[hw, -hh],
		[hw, hh],
		[-hw, hh]
	];

	const corners: Point[] = offsets.map(([dx, dy]) => [
		cx + dx * cos - dy * sin,
		cy + dx * sin + dy * cos
	]);
	return { corners };
}

/** Check if item center is inside a room polygon */
export function getItemRoom(item: Item, analysis: FloorplanAnalysisData): string | null {
	if (item.x === null || item.y === null) return null;
	const center: Point = [item.x + item.width / 2, item.y + item.height / 2];
	for (const room of analysis.rooms) {
		if (pointInPolygon(center, room.polygon)) {
			return room.id;
		}
	}
	return null;
}

/** Get items that fall within a room polygon */
export function getItemsInRoom(
	roomId: string,
	items: Item[],
	analysis: FloorplanAnalysisData
): Item[] {
	const room = analysis.rooms.find((r) => r.id === roomId);
	if (!room) return [];
	return items.filter((item) => {
		if (item.x === null || item.y === null) return false;
		const center: Point = [item.x + item.width / 2, item.y + item.height / 2];
		return pointInPolygon(center, room.polygon);
	});
}

/** Calculate polygon area using shoelace formula */
function polygonArea(polygon: Point[]): number {
	let area = 0;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		area += (polygon[j][0] + polygon[i][0]) * (polygon[j][1] - polygon[i][1]);
	}
	return Math.abs(area / 2);
}

/** Calculate available space in a room (room area minus item footprints) */
export function getRoomAvailableSpace(
	roomId: string,
	items: Item[],
	analysis: FloorplanAnalysisData
): {
	total_area_px: number;
	used_area_px: number;
	free_area_px: number;
	total_area_sqm: number | null;
	used_area_sqm: number | null;
	free_area_sqm: number | null;
} | null {
	const room = analysis.rooms.find((r) => r.id === roomId);
	if (!room) return null;

	const roomItems = getItemsInRoom(roomId, items, analysis);
	const totalArea = polygonArea(room.polygon);
	let usedArea = 0;
	for (const item of roomItems) {
		usedArea += item.width * item.height;
	}

	const ppm = analysis.scale?.pixels_per_meter;
	const ppm2 = ppm ? ppm * ppm : null;

	return {
		total_area_px: Math.round(totalArea),
		used_area_px: Math.round(usedArea),
		free_area_px: Math.round(totalArea - usedArea),
		total_area_sqm: ppm2 ? Math.round((totalArea / ppm2) * 100) / 100 : null,
		used_area_sqm: ppm2 ? Math.round((usedArea / ppm2) * 100) / 100 : null,
		free_area_sqm: ppm2 ? Math.round(((totalArea - usedArea) / ppm2) * 100) / 100 : null
	};
}

/** Line segment distance helper */
function distToSegment(p: Point, a: Point, b: Point): number {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const lenSq = dx * dx + dy * dy;
	if (lenSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
	let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
	t = Math.max(0, Math.min(1, t));
	return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Check if two convex polygons overlap using SAT (Separating Axis Theorem) */
function polygonsOverlap(a: Point[], b: Point[]): boolean {
	function getAxes(poly: Point[]): Point[] {
		const axes: Point[] = [];
		for (let i = 0; i < poly.length; i++) {
			const j = (i + 1) % poly.length;
			const edge: Point = [poly[j][0] - poly[i][0], poly[j][1] - poly[i][1]];
			axes.push([-edge[1], edge[0]]); // perpendicular
		}
		return axes;
	}
	function project(poly: Point[], axis: Point): [number, number] {
		let min = Infinity,
			max = -Infinity;
		for (const p of poly) {
			const dot = p[0] * axis[0] + p[1] * axis[1];
			if (dot < min) min = dot;
			if (dot > max) max = dot;
		}
		return [min, max];
	}
	for (const axis of [...getAxes(a), ...getAxes(b)]) {
		const [minA, maxA] = project(a, axis);
		const [minB, maxB] = project(b, axis);
		if (maxA < minB || maxB < minA) return false;
	}
	return true;
}

export type PlacementCheck = {
	valid: boolean;
	issues: string[];
	wall_collisions: string[];
	door_collisions: string[];
	item_collisions: string[];
	room_id: string | null;
};

/** Check if placing an item at (x, y, rotation) would collide with walls, doors, or other items */
export function checkPlacement(
	x: number,
	y: number,
	width: number,
	height: number,
	rotation: number,
	existingItems: Item[],
	analysis: FloorplanAnalysisData | null
): PlacementCheck {
	const issues: string[] = [];
	const wallCollisions: string[] = [];
	const doorCollisions: string[] = [];
	const itemCollisions: string[] = [];

	// Build the candidate item's rotated corners
	const cx = x + width / 2;
	const cy = y + height / 2;
	const rad = (rotation * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	const hw = width / 2;
	const hh = height / 2;
	const offsets: Point[] = [
		[-hw, -hh],
		[hw, -hh],
		[hw, hh],
		[-hw, hh]
	];
	const corners: Point[] = offsets.map(([dx, dy]) => [
		cx + dx * cos - dy * sin,
		cy + dx * sin + dy * cos
	]);

	// Determine which room the center falls in
	let roomId: string | null = null;
	if (analysis) {
		const center: Point = [cx, cy];
		for (const room of analysis.rooms) {
			if (pointInPolygon(center, room.polygon)) {
				roomId = room.id;
				break;
			}
		}

		// Check wall collisions
		const WALL_MARGIN = 5;
		for (const wall of analysis.walls) {
			for (const corner of corners) {
				const dist = distToSegment(corner, wall.start, wall.end);
				const threshold = (wall.thickness ?? 10) / 2 + WALL_MARGIN;
				if (dist < threshold) {
					wallCollisions.push(wall.id);
					break;
				}
			}
		}

		// Check door swing collisions
		const DOOR_SWING_MARGIN = 10;
		for (const opening of analysis.openings) {
			if (opening.type !== 'door') continue;
			const doorRadius = (opening.width ?? 80) + DOOR_SWING_MARGIN;
			for (const corner of corners) {
				const dist = Math.hypot(
					corner[0] - opening.position[0],
					corner[1] - opening.position[1]
				);
				if (dist < doorRadius) {
					doorCollisions.push(opening.id);
					break;
				}
			}
		}
	}

	// Check item-item collisions
	for (const other of existingItems) {
		const otherBounds = getItemBounds(other);
		if (!otherBounds) continue;
		if (polygonsOverlap(corners, otherBounds.corners)) {
			itemCollisions.push(other.id);
		}
	}

	if (wallCollisions.length > 0) issues.push(`Collides with ${wallCollisions.length} wall(s)`);
	if (doorCollisions.length > 0) issues.push(`Blocks ${doorCollisions.length} door swing zone(s)`);
	if (itemCollisions.length > 0)
		issues.push(`Overlaps with ${itemCollisions.length} existing item(s)`);

	return {
		valid: issues.length === 0,
		issues,
		wall_collisions: wallCollisions,
		door_collisions: doorCollisions,
		item_collisions: itemCollisions,
		room_id: roomId
	};
}
