# MCP Enhancement Plan: Batch Ops, Spatial Queries, Refresh Tokens, Resources & Prompts

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the MCP server with batch operations, spatial query tools, refresh token support, MCP resources, MCP prompts, and room-aware furniture suggestions.

**Architecture:** Six independent feature groups that all modify `src/routes/api/mcp/+server.ts` (new tools/resources/prompts), `src/lib/server/oauth.ts` (refresh tokens), and `src/lib/server/schema.ts` (new DB columns). Each feature is self-contained and can be implemented/committed independently.

**Tech Stack:** SvelteKit, `@modelcontextprotocol/sdk` v1.25.3, Drizzle ORM + PostgreSQL, Zod validation, Vitest

---

## Task 1: Batch Operations — `batch_add_items` and `batch_update_items`

Reduces N tool calls to 1 when furnishing a room. Reuses existing `createItem` / `updateItem` from `src/lib/server/items.ts`.

**Files:**
- Modify: `src/routes/api/mcp/+server.ts` (add 2 tools after `delete_furniture_item` ~line 398)

**Step 1: Add `batch_add_items` tool**

In `src/routes/api/mcp/+server.ts`, after the `delete_furniture_item` tool registration (line ~398), add:

```typescript
server.registerTool(
  'batch_add_items',
  {
    description:
      'Add multiple furniture items to a project branch in one call. Each item is added to the inventory (not placed on canvas unless x/y provided). Max 50 items per call.',
    inputSchema: {
      project_id: z.string().uuid(),
      branch_id: z.string().uuid(),
      items: z.array(z.object({
        name: z.string().min(1),
        width: z.number().positive(),
        height: z.number().positive(),
        x: z.number().nullable().optional(),
        y: z.number().nullable().optional(),
        rotation: z.number().optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        price: z.number().positive().optional(),
        priceCurrency: z.string().optional(),
        productUrl: z.string().url().optional(),
        shape: z.enum(['rectangle', 'l-shape']).optional(),
        cutoutWidth: z.number().positive().optional(),
        cutoutHeight: z.number().positive().optional(),
        cutoutCorner: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).optional()
      })).min(1).max(50)
    }
  },
  async ({ project_id, branch_id, items: itemsInput }) => {
    await ensureProjectRole(project_id, 'editor');
    await ensureBranch(project_id, branch_id);

    const created = [];
    for (const itemData of itemsInput) {
      const item = await createItem(project_id, branch_id, userId, {
        ...itemData,
        x: itemData.x ?? null,
        y: itemData.y ?? null
      });
      created.push({
        id: item.id,
        name: item.name,
        width: item.width,
        height: item.height,
        x: item.x,
        y: item.y
      });
    }

    return asText({
      created_count: created.length,
      items: created
    });
  }
);
```

**Step 2: Add `batch_update_items` tool**

Immediately after `batch_add_items`:

```typescript
server.registerTool(
  'batch_update_items',
  {
    description:
      'Update multiple furniture items in a single call. Useful for repositioning multiple items at once (e.g., rearranging a room). Max 50 items per call.',
    inputSchema: {
      project_id: z.string().uuid(),
      branch_id: z.string().uuid(),
      updates: z.array(z.object({
        item_id: z.string().uuid(),
        name: z.string().min(1).optional(),
        width: z.number().positive().optional(),
        height: z.number().positive().optional(),
        x: z.number().nullable().optional(),
        y: z.number().nullable().optional(),
        rotation: z.number().optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        price: z.number().positive().nullable().optional(),
        priceCurrency: z.string().optional(),
        productUrl: z.string().url().nullable().optional()
      })).min(1).max(50)
    }
  },
  async ({ project_id, branch_id, updates }) => {
    await ensureProjectRole(project_id, 'editor');
    await ensureBranch(project_id, branch_id);

    const results = [];
    for (const { item_id, ...data } of updates) {
      const item = await updateItem(project_id, branch_id, item_id, userId, data);
      if (!item) {
        results.push({ item_id, success: false, error: 'Item not found' });
      } else {
        results.push({
          item_id: item.id,
          success: true,
          name: item.name,
          x: item.x,
          y: item.y,
          rotation: item.rotation
        });
      }
    }

    return asText({
      updated_count: results.filter(r => r.success).length,
      failed_count: results.filter(r => !r.success).length,
      results
    });
  }
);
```

**Step 3: Run type-check**

Run: `bun check`
Expected: No errors

**Step 4: Commit**

```bash
git add src/routes/api/mcp/+server.ts
git commit -m "feat(mcp): add batch_add_items and batch_update_items tools"
```

---

## Task 2: Spatial Query Tools — `get_room_contents`, `get_available_space`, `check_placement`

These tools combine the floorplan analysis data with item positions to give the AI spatial awareness. They are pure computation — no new DB tables needed.

**Files:**
- Create: `src/lib/server/spatial-queries.ts` (geometry logic)
- Modify: `src/routes/api/mcp/+server.ts` (add 3 tools)

**Step 1: Create spatial query module**

Create `src/lib/server/spatial-queries.ts`:

```typescript
import type { FloorplanAnalysisData } from './floorplan-analyses';
import type { Item } from './db';

type Point = [number, number];

/** Check if point is inside polygon using ray-casting algorithm */
function pointInPolygon(point: Point, polygon: Point[]): boolean {
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const xi = polygon[i][0], yi = polygon[i][1];
		const xj = polygon[j][0], yj = polygon[j][1];
		const intersect = ((yi > point[1]) !== (yj > point[1])) &&
			(point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi);
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
	const offsets: Point[] = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];

	const corners: Point[] = offsets.map(([dx, dy]) => [
		cx + dx * cos - dy * sin,
		cy + dx * sin + dy * cos
	]);
	return { corners };
}

/** Check if item center is inside a room polygon */
export function getItemRoom(
	item: Item,
	analysis: FloorplanAnalysisData
): string | null {
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
	const room = analysis.rooms.find(r => r.id === roomId);
	if (!room) return [];
	return items.filter(item => {
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
): { total_area_px: number; used_area_px: number; free_area_px: number; total_area_sqm: number | null; used_area_sqm: number | null; free_area_sqm: number | null } | null {
	const room = analysis.rooms.find(r => r.id === roomId);
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
		let min = Infinity, max = -Infinity;
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
	const offsets: Point[] = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
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
				const dist = Math.hypot(corner[0] - opening.position[0], corner[1] - opening.position[1]);
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
	if (itemCollisions.length > 0) issues.push(`Overlaps with ${itemCollisions.length} existing item(s)`);

	return {
		valid: issues.length === 0,
		issues,
		wall_collisions: wallCollisions,
		door_collisions: doorCollisions,
		item_collisions: itemCollisions,
		room_id: roomId
	};
}
```

**Step 2: Run type-check**

Run: `bun check`
Expected: No errors

**Step 3: Register spatial query tools in MCP server**

In `src/routes/api/mcp/+server.ts`, add imports at top:

```typescript
import {
	getItemsInRoom,
	getRoomAvailableSpace,
	checkPlacement
} from '$lib/server/spatial-queries';
```

Then register three tools after `get_floorplan_analysis` (line ~769):

```typescript
server.registerTool(
  'get_room_contents',
  {
    description:
      'List all furniture items placed within a specific room. Requires a floorplan analysis to exist (rooms must be defined). Uses the item center point to determine room membership.',
    inputSchema: {
      project_id: z.string().uuid(),
      branch_id: z.string().uuid(),
      room_id: z.string()
    }
  },
  async ({ project_id, branch_id, room_id }) => {
    await ensureProjectRole(project_id, 'viewer');
    await ensureBranch(project_id, branch_id);

    const analysis = await getFloorplanAnalysis(project_id);
    if (!analysis) {
      throw new Error('No floorplan analysis found. Run save_floorplan_analysis first.');
    }

    const room = analysis.rooms.find(r => r.id === room_id);
    if (!room) {
      throw new Error(`Room "${room_id}" not found. Available rooms: ${analysis.rooms.map(r => `${r.id} (${r.type})`).join(', ')}`);
    }

    const branchItems = await getBranchItems(project_id, branch_id);
    const roomItems = getItemsInRoom(room_id, branchItems, analysis);

    return asText({
      room_id: room.id,
      room_type: room.type,
      room_label: room.label ?? room.type,
      item_count: roomItems.length,
      items: roomItems.map(item => ({
        id: item.id,
        name: item.name,
        width: item.width,
        height: item.height,
        x: item.x,
        y: item.y,
        rotation: item.rotation
      }))
    });
  }
);

server.registerTool(
  'get_available_space',
  {
    description:
      'Calculate the available floor space in a room by subtracting furniture footprints from the room area. Returns both pixel and real-world (sqm) measurements when scale data exists.',
    inputSchema: {
      project_id: z.string().uuid(),
      branch_id: z.string().uuid(),
      room_id: z.string()
    }
  },
  async ({ project_id, branch_id, room_id }) => {
    await ensureProjectRole(project_id, 'viewer');
    await ensureBranch(project_id, branch_id);

    const analysis = await getFloorplanAnalysis(project_id);
    if (!analysis) {
      throw new Error('No floorplan analysis found. Run save_floorplan_analysis first.');
    }

    const branchItems = await getBranchItems(project_id, branch_id);
    const space = getRoomAvailableSpace(room_id, branchItems, analysis);
    if (!space) {
      throw new Error(`Room "${room_id}" not found. Available rooms: ${analysis.rooms.map(r => `${r.id} (${r.type})`).join(', ')}`);
    }

    const room = analysis.rooms.find(r => r.id === room_id)!;
    return asText({
      room_id: room.id,
      room_type: room.type,
      room_label: room.label ?? room.type,
      ...space
    });
  }
);

server.registerTool(
  'check_placement',
  {
    description:
      'Validate a proposed furniture placement BEFORE committing it. Checks for collisions with walls, door swing zones, and existing items. Returns whether the placement is valid and lists any issues. Always use this before update_furniture_item to avoid placing items in invalid positions.',
    inputSchema: {
      project_id: z.string().uuid(),
      branch_id: z.string().uuid(),
      x: z.number(),
      y: z.number(),
      width: z.number().positive(),
      height: z.number().positive(),
      rotation: z.number().default(0),
      exclude_item_id: z.string().uuid().optional().describe('Item ID to exclude from collision checks (use when repositioning an existing item)')
    }
  },
  async ({ project_id, branch_id, x, y, width, height, rotation, exclude_item_id }) => {
    await ensureProjectRole(project_id, 'viewer');
    await ensureBranch(project_id, branch_id);

    const analysis = await getFloorplanAnalysis(project_id);
    const branchItems = await getBranchItems(project_id, branch_id);
    const filteredItems = exclude_item_id
      ? branchItems.filter(i => i.id !== exclude_item_id)
      : branchItems;

    const result = checkPlacement(x, y, width, height, rotation, filteredItems, analysis);
    return asText(result);
  }
);
```

**Step 4: Run type-check**

Run: `bun check`
Expected: No errors

**Step 5: Commit**

```bash
git add src/lib/server/spatial-queries.ts src/routes/api/mcp/+server.ts
git commit -m "feat(mcp): add spatial query tools — get_room_contents, get_available_space, check_placement"
```

---

## Task 3: Unit Tests for Spatial Queries

Test the pure geometry functions independently from the MCP layer.

**Files:**
- Create: `src/lib/server/spatial-queries.test.ts`

**Step 1: Write tests**

Create `src/lib/server/spatial-queries.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
	getItemsInRoom,
	getRoomAvailableSpace,
	checkPlacement,
	getItemRoom
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
			polygon: [[0, 0], [500, 0], [500, 400], [0, 400]],
			label: 'Living Room'
		},
		{
			id: 'room-2',
			type: 'bedroom',
			polygon: [[500, 0], [900, 0], [900, 400], [500, 400]],
			label: 'Bedroom'
		}
	],
	walls: [
		{ id: 'wall-1', start: [0, 0], end: [500, 0], thickness: 10 },
		{ id: 'wall-2', start: [500, 0], end: [500, 400], thickness: 10 }
	],
	openings: [
		{ id: 'door-1', type: 'door', position: [250, 0], width: 80 }
	],
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
		// Place item right on the top wall (y=0, wall at y=0)
		const result = checkPlacement(200, -20, 100, 50, 0, [], analysis);
		expect(result.wall_collisions.length).toBeGreaterThan(0);
		expect(result.valid).toBe(false);
	});

	it('detects door swing collision', () => {
		// Place item right at door position (250, 0) with door width 80
		const result = checkPlacement(200, -30, 100, 50, 0, [], analysis);
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
```

**Step 2: Run tests**

Run: `bun test src/lib/server/spatial-queries.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/lib/server/spatial-queries.test.ts
git commit -m "test(mcp): add unit tests for spatial query module"
```

---

## Task 4: Refresh Token Support

Add `refresh_token` grant type so AI clients don't need to re-authorize every 7 days. Access tokens stay short-lived (1 hour), refresh tokens last 30 days.

**Files:**
- Modify: `src/lib/server/schema.ts` (add `refreshTokenHash` column to `oauth_tokens`)
- Modify: `src/lib/server/oauth.ts` (new functions + modify `createAccessToken`)
- Modify: `src/routes/api/oauth/token/+server.ts` (handle `refresh_token` grant)
- Modify: `src/routes/.well-known/oauth-authorization-server/+server.ts` (advertise grant type)

**Step 1: Add refresh token column to schema**

In `src/lib/server/schema.ts`, modify the `oauthTokens` table definition (line ~320). Add after `accessTokenHash`:

```typescript
refreshTokenHash: text('refresh_token_hash'),
refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
```

**Step 2: Generate and run migration**

Run: `bun db:generate`
Expected: New migration SQL file created in `drizzle/` directory

Run: `bun db:migrate`
Expected: Migration applied successfully

**Step 3: Update OAuth constants and functions**

In `src/lib/server/oauth.ts`, update the constants (around line 19-21):

Change:
```typescript
export const ACCESS_TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
```
To:
```typescript
export const ACCESS_TOKEN_LIFETIME_MS = 60 * 60 * 1000; // 1 hour
export const REFRESH_TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
```

Then update `createAccessToken` (line ~459) to also generate a refresh token:

```typescript
export async function createAccessToken(
	userId: string,
	clientId: string
): Promise<{ accessToken: string; refreshToken: string }> {
	const db = getDB();

	const accessToken = generateToken(32);
	const refreshToken = generateToken(32);
	const accessTokenHash = hashAccessToken(accessToken);
	const refreshTokenHash = hashAccessToken(refreshToken);

	const expiresAt = new Date(Date.now() + ACCESS_TOKEN_LIFETIME_MS);
	const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MS);

	await db.insert(oauthTokens).values({
		accessTokenHash,
		refreshTokenHash,
		clientId,
		userId,
		expiresAt,
		refreshTokenExpiresAt
	});

	return { accessToken, refreshToken };
}
```

Add a new function for refresh token exchange:

```typescript
/**
 * Exchange a refresh token for a new access token + refresh token pair.
 * The old token row is deleted and a new one is created (rotation).
 */
export async function refreshAccessToken(
	refreshToken: string,
	clientId: string
): Promise<{ accessToken: string; refreshToken: string; userId: string } | undefined> {
	const db = getDB();
	const tokenHash = hashAccessToken(refreshToken);
	const now = new Date();

	const tokenRecord = await db.query.oauthTokens.findFirst({
		where: and(
			eq(oauthTokens.refreshTokenHash, tokenHash),
			eq(oauthTokens.clientId, clientId),
			gt(oauthTokens.refreshTokenExpiresAt, now)
		)
	});

	if (!tokenRecord) return undefined;

	// Delete old token (rotation — prevents reuse)
	await db.delete(oauthTokens).where(eq(oauthTokens.id, tokenRecord.id));

	// Issue new pair
	const result = await createAccessToken(tokenRecord.userId, clientId);
	return { ...result, userId: tokenRecord.userId };
}
```

**Step 4: Fix all callers of `createAccessToken`**

The return type changed from `string` to `{ accessToken, refreshToken }`. Update the token endpoint.

In `src/routes/api/oauth/token/+server.ts`, change line ~122:

From:
```typescript
const accessToken = await createAccessToken(userId, clientId);
```
To:
```typescript
const { accessToken, refreshToken } = await createAccessToken(userId, clientId);
```

Also update the import to include `refreshAccessToken` and `REFRESH_TOKEN_LIFETIME_MS`:

```typescript
import {
	verifyOAuthClient,
	getPublicOAuthClient,
	consumeAuthorizationCode,
	createAccessToken,
	refreshAccessToken,
	ACCESS_TOKEN_LIFETIME_MS,
	REFRESH_TOKEN_LIFETIME_MS,
	isValidCodeVerifier
} from '$lib/server/oauth';
```

Update the response (line ~128):

From:
```typescript
return json(
  {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn
  },
```
To:
```typescript
return json(
  {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    refresh_token: refreshToken
  },
```

**Step 5: Add `refresh_token` grant handler**

In `src/routes/api/oauth/token/+server.ts`, change the grant type validation (line ~59):

From:
```typescript
if (grantType !== 'authorization_code') {
  return json(
    {
      error: 'unsupported_grant_type',
      error_description: 'Only "authorization_code" grant type is supported'
    },
    { status: 400 }
  );
}
```

To:
```typescript
if (grantType !== 'authorization_code' && grantType !== 'refresh_token') {
  return json(
    {
      error: 'unsupported_grant_type',
      error_description: 'Supported grant types: authorization_code, refresh_token'
    },
    { status: 400 }
  );
}

// Handle refresh_token grant
if (grantType === 'refresh_token') {
  const refreshTokenValue = formData.get('refresh_token');
  if (!refreshTokenValue || typeof refreshTokenValue !== 'string' || !clientId || typeof clientId !== 'string') {
    return json(
      { error: 'invalid_request', error_description: 'Missing refresh_token or client_id' },
      { status: 400 }
    );
  }

  // Verify client (optional secret for confidential clients)
  let client;
  if (clientSecret && typeof clientSecret === 'string') {
    client = await verifyOAuthClient(clientId, clientSecret);
  } else {
    client = await getPublicOAuthClient(clientId);
  }
  if (!client) {
    return json({ error: 'invalid_client', error_description: 'Invalid client credentials' }, { status: 401 });
  }

  const result = await refreshAccessToken(refreshTokenValue, clientId);
  if (!result) {
    return json(
      { error: 'invalid_grant', error_description: 'Invalid or expired refresh token' },
      { status: 400 }
    );
  }

  return json(
    {
      access_token: result.accessToken,
      token_type: 'Bearer',
      expires_in: Math.floor(ACCESS_TOKEN_LIFETIME_MS / 1000),
      refresh_token: result.refreshToken
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' }
    }
  );
}
```

The existing `authorization_code` flow code below remains unchanged (except for the `codeVerifier` requirement which only applies to auth code flow — it's already gated by the param check).

**Step 6: Update well-known metadata**

In `src/routes/.well-known/oauth-authorization-server/+server.ts`, change line 21:

From:
```typescript
grant_types_supported: ['authorization_code'],
```
To:
```typescript
grant_types_supported: ['authorization_code', 'refresh_token'],
```

**Step 7: Run type-check**

Run: `bun check`
Expected: No errors

**Step 8: Commit**

```bash
git add src/lib/server/schema.ts src/lib/server/oauth.ts src/routes/api/oauth/token/+server.ts src/routes/.well-known/oauth-authorization-server/+server.ts drizzle/
git commit -m "feat(oauth): add refresh token support with 1-hour access tokens and 30-day refresh tokens"
```

---

## Task 5: MCP Resources

Expose read-only data as MCP resources so AI clients can load project context without tool calls.

**Files:**
- Modify: `src/routes/api/mcp/+server.ts` (add resource registrations)

**Step 1: Add resource registrations**

The `@modelcontextprotocol/sdk` `McpServer` supports `server.resource()` for registering resources. Add these after all tool registrations, before `return server;` (line ~771):

```typescript
server.resource(
  'project-summary',
  'project://{project_id}/summary',
  {
    description: 'Project metadata including name, dimensions, currency, grid size, branch count, and item count.',
    mimeType: 'application/json'
  },
  async (uri, { project_id }) => {
    await ensureProjectRole(project_id, 'viewer');
    const projectList = await getUserProjects(userId);
    const project = projectList.find(p => p.id === project_id);
    if (!project) throw new Error('Project not found');

    const projectBranches = await listProjectBranches(project_id);
    const defaultBranch = await getDefaultBranch(project_id);
    let itemCount = 0;
    if (defaultBranch) {
      const branchItems = await getBranchItems(project_id, defaultBranch.id);
      itemCount = branchItems.length;
    }

    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify({
          id: project.id,
          name: project.name,
          width: project.width,
          height: project.height,
          currency: project.currency,
          grid_size: project.gridSize,
          branch_count: projectBranches.length,
          default_branch_id: defaultBranch?.id ?? null,
          item_count: itemCount,
          created_at: project.createdAt?.toISOString(),
          updated_at: project.updatedAt?.toISOString()
        }, null, 2)
      }]
    };
  }
);

server.resource(
  'floorplan-analysis',
  'project://{project_id}/floorplan-analysis',
  {
    description: 'Cached floorplan analysis with rooms, walls, openings, and scale data. Returns null if no analysis exists.',
    mimeType: 'application/json'
  },
  async (uri, { project_id }) => {
    await ensureProjectRole(project_id, 'viewer');
    const analysis = await getFloorplanAnalysis(project_id);
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(analysis, null, 2)
      }]
    };
  }
);

server.resource(
  'branch-items',
  'project://{project_id}/branches/{branch_id}/items',
  {
    description: 'Complete furniture inventory for a branch, including positions and dimensions.',
    mimeType: 'application/json'
  },
  async (uri, { project_id, branch_id }) => {
    await ensureProjectRole(project_id, 'viewer');
    await ensureBranch(project_id, branch_id);
    const branchItems = await getBranchItems(project_id, branch_id);
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(branchItems.map(item => ({
          id: item.id,
          name: item.name,
          width: item.width,
          height: item.height,
          x: item.x,
          y: item.y,
          rotation: item.rotation,
          color: item.color,
          price: item.price,
          price_currency: item.priceCurrency,
          product_url: item.productUrl,
          shape: item.shape
        })), null, 2)
      }]
    };
  }
);
```

**Step 2: Run type-check**

Run: `bun check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/routes/api/mcp/+server.ts
git commit -m "feat(mcp): add resources — project summary, floorplan analysis, branch items"
```

---

## Task 6: MCP Prompts — Guided AI Workflows

Register MCP prompts that guide AI clients through common workflows.

**Files:**
- Modify: `src/routes/api/mcp/+server.ts` (add prompt registrations)

**Step 1: Add prompt registrations**

The `McpServer` class supports `server.prompt()`. Add these after the resource registrations, before `return server;`:

```typescript
server.prompt(
  'furnish-room',
  {
    description: 'Guided workflow to furnish a specific room with appropriate furniture items.',
    argsSchema: {
      project_id: z.string().uuid(),
      branch_id: z.string().uuid(),
      room_id: z.string(),
      style: z.string().optional().describe('Furniture style preference (e.g., modern, minimalist, cozy)')
    }
  },
  async ({ project_id, branch_id, room_id, style }) => {
    await ensureProjectRole(project_id, 'viewer');

    const analysis = await getFloorplanAnalysis(project_id);
    if (!analysis) {
      return {
        messages: [{
          role: 'user',
          content: { type: 'text', text: `No floorplan analysis found for project ${project_id}. Please first use get_project_preview to view the floorplan, then save_floorplan_analysis to extract room data.` }
        }]
      };
    }

    const room = analysis.rooms.find(r => r.id === room_id);
    if (!room) {
      return {
        messages: [{
          role: 'user',
          content: { type: 'text', text: `Room "${room_id}" not found. Available rooms: ${analysis.rooms.map(r => `${r.id} (${r.type}${r.label ? ': ' + r.label : ''})`).join(', ')}` }
        }]
      };
    }

    const branchItems = await getBranchItems(project_id, branch_id);
    const roomItemCount = branchItems.filter(item => {
      if (item.x === null || item.y === null) return false;
      const cx = item.x + item.width / 2;
      const cy = item.y + item.height / 2;
      // Simple point-in-polygon check inline
      let inside = false;
      const poly = room.polygon;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const intersect = ((poly[i][1] > cy) !== (poly[j][1] > cy)) &&
          (cx < (poly[j][0] - poly[i][0]) * (cy - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0]);
        if (intersect) inside = !inside;
      }
      return inside;
    }).length;

    const scaleInfo = analysis.scale
      ? `Scale: ${analysis.scale.pixels_per_meter} pixels/meter.`
      : 'No scale data available — dimensions are in pixels.';

    const styleNote = style ? `Style preference: ${style}.` : '';

    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Please furnish the ${room.type}${room.label ? ` (${room.label})` : ''} in project ${project_id}, branch ${branch_id}.

Room details:
- ID: ${room.id}
- Type: ${room.type}
- Area: ${room.area_sqm ? room.area_sqm + ' sqm' : 'unknown'}
- Dimensions: ${room.dimensions ? `${room.dimensions.width}x${room.dimensions.height}` : 'see polygon'}
- Current items in room: ${roomItemCount}
- Walls nearby: ${analysis.walls.length} total
- Doors/windows nearby: ${analysis.openings.length} total
${scaleInfo}
${styleNote}

Steps:
1. Use get_available_space to check how much room you have
2. Decide which furniture items are appropriate for a ${room.type}
3. Use batch_add_items to add all items at once
4. Use check_placement for each item before setting positions
5. Use batch_update_items to place all items with valid positions
6. Use get_project_preview to verify the final layout looks good`
        }
      }]
    };
  }
);

server.prompt(
  'optimize-layout',
  {
    description: 'Analyze the current furniture layout and suggest improvements for better space usage, traffic flow, and aesthetics.',
    argsSchema: {
      project_id: z.string().uuid(),
      branch_id: z.string().uuid()
    }
  },
  async ({ project_id, branch_id }) => {
    await ensureProjectRole(project_id, 'viewer');
    await ensureBranch(project_id, branch_id);

    const analysis = await getFloorplanAnalysis(project_id);
    const branchItems = await getBranchItems(project_id, branch_id);

    const placedItems = branchItems.filter(i => i.x !== null && i.y !== null);
    const unplacedItems = branchItems.filter(i => i.x === null || i.y === null);

    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Please analyze and optimize the furniture layout for project ${project_id}, branch ${branch_id}.

Current state:
- Total items: ${branchItems.length}
- Placed on canvas: ${placedItems.length}
- In inventory (unplaced): ${unplacedItems.length}
- Rooms defined: ${analysis ? analysis.rooms.length : 'No floorplan analysis — run save_floorplan_analysis first'}
- Walls: ${analysis ? analysis.walls.length : 'unknown'}
- Doors/windows: ${analysis ? analysis.openings.length : 'unknown'}

Steps:
1. Use get_project_preview to see the current layout
2. For each room, use get_room_contents and get_available_space
3. Identify issues: blocked doors, overlapping items, wasted space, poor traffic flow
4. Use check_placement to validate proposed new positions
5. Use batch_update_items to reposition items
6. Use get_project_preview to verify improvements`
        }
      }]
    };
  }
);

server.prompt(
  'shopping-list',
  {
    description: 'Generate a furniture shopping list based on empty or under-furnished rooms.',
    argsSchema: {
      project_id: z.string().uuid(),
      branch_id: z.string().uuid(),
      budget: z.string().optional().describe('Budget constraint (e.g., "500 EUR")')
    }
  },
  async ({ project_id, branch_id, budget }) => {
    await ensureProjectRole(project_id, 'viewer');
    await ensureBranch(project_id, branch_id);

    const analysis = await getFloorplanAnalysis(project_id);
    const branchItems = await getBranchItems(project_id, branch_id);

    const totalSpent = branchItems
      .filter(i => i.price !== null)
      .reduce((sum, i) => sum + (i.price ?? 0), 0);

    const budgetNote = budget ? `Budget: ${budget}. Already spent: ${totalSpent} EUR.` : `Current total: ${totalSpent} EUR.`;

    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Generate a furniture shopping list for project ${project_id}, branch ${branch_id}.

${budgetNote}
Current item count: ${branchItems.length}
Rooms: ${analysis ? analysis.rooms.map(r => `${r.type}${r.label ? ` (${r.label})` : ''}`).join(', ') : 'No floorplan analysis — analyze first'}

Steps:
1. Use get_project_preview to see the current layout
2. For each room, use get_room_contents to see what's already there
3. Identify what's missing (e.g., bedroom without bed, living room without sofa)
4. Suggest specific items with estimated dimensions and prices
5. Use batch_add_items to add suggested items to inventory
6. Summarize the total estimated cost`
        }
      }]
    };
  }
);
```

**Step 2: Run type-check**

Run: `bun check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/routes/api/mcp/+server.ts
git commit -m "feat(mcp): add prompts — furnish-room, optimize-layout, shopping-list"
```

---

## Task 7: Room-Aware Furniture Suggestions — `suggest_placement`

Uses floorplan analysis + existing items to compute a valid position for a new item in a given room.

**Files:**
- Modify: `src/lib/server/spatial-queries.ts` (add `suggestPlacement` function)
- Modify: `src/routes/api/mcp/+server.ts` (add tool)

**Step 1: Add suggestion logic**

In `src/lib/server/spatial-queries.ts`, add at the bottom:

```typescript
/** Suggest a valid placement for an item in a room using grid search */
export function suggestPlacement(
	roomId: string,
	width: number,
	height: number,
	existingItems: Item[],
	analysis: FloorplanAnalysisData,
	gridStep: number = 20
): { x: number; y: number; rotation: number } | null {
	const room = analysis.rooms.find(r => r.id === roomId);
	if (!room) return null;

	// Get room bounding box
	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
	for (const [px, py] of room.polygon) {
		if (px < minX) minX = px;
		if (py < minY) minY = py;
		if (px > maxX) maxX = px;
		if (py > maxY) maxY = py;
	}

	// Add margin from walls
	const margin = 15;
	minX += margin;
	minY += margin;
	maxX -= margin;
	maxY -= margin;

	// Try placing along walls first (common furniture placement)
	// Then try interior positions
	for (const rotation of [0, 90, 180, 270]) {
		const effectiveW = rotation % 180 === 0 ? width : height;
		const effectiveH = rotation % 180 === 0 ? height : width;

		for (let y = minY; y + effectiveH <= maxY; y += gridStep) {
			for (let x = minX; x + effectiveW <= maxX; x += gridStep) {
				const center: Point = [x + effectiveW / 2, y + effectiveH / 2];
				if (!pointInPolygon(center, room.polygon)) continue;

				const check = checkPlacement(x, y, effectiveW, effectiveH, 0, existingItems, analysis);
				if (check.valid) {
					return { x, y, rotation };
				}
			}
		}
	}

	return null;
}
```

Note: `pointInPolygon` is already defined in the file (not exported). It needs to stay accessible. Since it's module-scoped, this works as-is.

**Step 2: Register the tool**

In `src/routes/api/mcp/+server.ts`, add import for `suggestPlacement`:

```typescript
import {
	getItemsInRoom,
	getRoomAvailableSpace,
	checkPlacement,
	suggestPlacement
} from '$lib/server/spatial-queries';
```

Add tool after `check_placement`:

```typescript
server.registerTool(
  'suggest_placement',
  {
    description:
      'Find a valid position for a furniture item within a specific room. Uses grid search to find a spot that avoids walls, doors, and existing items. Returns suggested x, y, rotation or null if no valid position found. Requires floorplan analysis.',
    inputSchema: {
      project_id: z.string().uuid(),
      branch_id: z.string().uuid(),
      room_id: z.string(),
      width: z.number().positive(),
      height: z.number().positive()
    }
  },
  async ({ project_id, branch_id, room_id, width, height }) => {
    await ensureProjectRole(project_id, 'viewer');
    await ensureBranch(project_id, branch_id);

    const analysis = await getFloorplanAnalysis(project_id);
    if (!analysis) {
      throw new Error('No floorplan analysis found. Run save_floorplan_analysis first.');
    }

    const branchItems = await getBranchItems(project_id, branch_id);
    const suggestion = suggestPlacement(room_id, width, height, branchItems, analysis);

    if (!suggestion) {
      return asText({
        found: false,
        message: `No valid position found for a ${width}x${height} item in room "${room_id}". The room may be too full.`
      });
    }

    return asText({
      found: true,
      x: suggestion.x,
      y: suggestion.y,
      rotation: suggestion.rotation,
      message: `Suggested position: (${suggestion.x}, ${suggestion.y}) with rotation ${suggestion.rotation}°`
    });
  }
);
```

**Step 3: Add tests for suggestPlacement**

Append to `src/lib/server/spatial-queries.test.ts`:

```typescript
// Import suggestPlacement
import { suggestPlacement } from './spatial-queries';

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
			rooms: [{ id: 'tiny', type: 'closet', polygon: [[0,0],[30,0],[30,30],[0,30]] }],
			walls: [
				{ id: 'w1', start: [0,0], end: [30,0], thickness: 10 },
				{ id: 'w2', start: [30,0], end: [30,30], thickness: 10 },
				{ id: 'w3', start: [30,30], end: [0,30], thickness: 10 },
				{ id: 'w4', start: [0,30], end: [0,0], thickness: 10 }
			],
			openings: []
		};
		expect(suggestPlacement('tiny', 100, 50, [], tinyAnalysis)).toBeNull();
	});
});
```

**Step 4: Run tests**

Run: `bun test src/lib/server/spatial-queries.test.ts`
Expected: All tests pass

**Step 5: Run type-check**

Run: `bun check`
Expected: No errors

**Step 6: Commit**

```bash
git add src/lib/server/spatial-queries.ts src/lib/server/spatial-queries.test.ts src/routes/api/mcp/+server.ts
git commit -m "feat(mcp): add suggest_placement tool for room-aware furniture positioning"
```

---

## Task 8: Update MCP Settings Page & Discovery Metadata

Update the capabilities list shown to users, and bump the MCP server version.

**Files:**
- Modify: `src/routes/settings/mcp/+page.svelte` (update capabilities list)
- Modify: `src/routes/api/mcp/+server.ts` (bump version)

**Step 1: Bump MCP server version**

In `src/routes/api/mcp/+server.ts`, line 45:

From:
```typescript
const MCP_SERVER_VERSION = '2.0.0';
```
To:
```typescript
const MCP_SERVER_VERSION = '3.0.0';
```

**Step 2: Update settings page capabilities**

In `src/routes/settings/mcp/+page.svelte`, replace the capabilities list (lines ~255-320) with updated entries reflecting all new tools. Add entries for:
- Batch add/update multiple items at once
- Check placement validity before positioning
- Get room contents and available space
- AI-suggested furniture placement
- Guided workflows (furnish room, optimize layout, shopping list)

Keep the same SVG checkmark pattern already used.

**Step 3: Run type-check**

Run: `bun check`
Expected: No errors

**Step 4: Commit**

```bash
git add src/routes/api/mcp/+server.ts src/routes/settings/mcp/+page.svelte
git commit -m "feat(mcp): bump to v3.0.0 and update settings page capabilities"
```

---

## Summary

| Task | Feature | New Tools/Resources | Files Changed |
|------|---------|-------------------|---------------|
| 1 | Batch Operations | `batch_add_items`, `batch_update_items` | MCP server |
| 2 | Spatial Queries | `get_room_contents`, `get_available_space`, `check_placement` | New module + MCP server |
| 3 | Spatial Tests | — | New test file |
| 4 | Refresh Tokens | — | Schema, OAuth, token endpoint, well-known |
| 5 | MCP Resources | 3 resources | MCP server |
| 6 | MCP Prompts | 3 prompts | MCP server |
| 7 | Suggest Placement | `suggest_placement` | Spatial module + MCP server |
| 8 | Settings & Version | — | Settings page + MCP server |

**Total new MCP tools:** 6 (batch_add_items, batch_update_items, get_room_contents, get_available_space, check_placement, suggest_placement)
**Total new MCP resources:** 3 (project summary, floorplan analysis, branch items)
**Total new MCP prompts:** 3 (furnish-room, optimize-layout, shopping-list)
