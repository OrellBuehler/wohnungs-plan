# Wall & Door Integration Plan

## 🎯 Goal
Render AI-detected walls and doors as a separate visual layer on the canvas, without interfering with the floorplan image or furniture items.

## 📐 Canvas Layer Architecture

```
┌─────────────────────────────────────────┐
│  Layer 0: Floorplan Image (Background)  │  ← Base image
│─────────────────────────────────────────│
│  Layer 1: Walls & Doors (Overlay)       │  ← NEW! Semi-transparent
│─────────────────────────────────────────│
│  Layer 2: Furniture Items (Interactive) │  ← Existing draggable items
│─────────────────────────────────────────│
│  Layer 3: UI Controls (Top)             │  ← Existing controls
└─────────────────────────────────────────┘
```

## 📊 Data Flow

```
AI Analysis (DB) → API Endpoint → Frontend Store → Canvas Layer → Visual Render
     ↓                  ↓              ↓               ↓              ↓
JSONB data       GET /api/...   $state.walls     Konva.Group    Lines & Arcs
                                $state.doors
```

---

## 🗂️ Phase 1: Backend API (Get Analysis Data)

### 1.1 Create API Endpoint
**File:** `src/routes/api/projects/[id]/floorplan-analysis/+server.ts`

```typescript
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { getProjectRole } from '$lib/server/projects';
import { getFloorplanAnalysis } from '$lib/server/floorplan-analyses';

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) {
    throw error(401, 'Authentication required');
  }

  const projectId = params.id;
  const role = await getProjectRole(projectId, locals.user.id);

  if (!role) {
    throw error(403, 'Access denied');
  }

  const analysis = await getFloorplanAnalysis(projectId);

  if (!analysis) {
    return json({ exists: false, data: null });
  }

  return json({
    exists: true,
    data: {
      walls: analysis.walls,
      doors: analysis.openings.filter(o => o.type === 'door'),
      windows: analysis.openings.filter(o => o.type === 'window'),
      rooms: analysis.rooms,
      scale: analysis.scale,
      metadata: analysis.metadata
    }
  });
};
```

**Why separate endpoint?**
- Lighter payload (only walls/doors, not all items)
- Can be cached separately
- Independent loading from items

---

## 🎨 Phase 2: Frontend Store (State Management)

### 2.1 Extend Project Store
**File:** `src/lib/stores/project.svelte.ts`

Add new state for floorplan analysis:

```typescript
type FloorplanAnalysisState = {
  loaded: boolean;
  walls: Wall[];
  doors: Door[];
  windows: Window[];
  rooms: Room[];
  scale: Scale | null;
  visible: boolean; // Toggle layer visibility
};

type Wall = {
  id: string;
  start: [number, number];
  end: [number, number];
  thickness?: number;
};

type Door = {
  id: string;
  position: [number, number];
  width: number;
  wall_id?: string;
};

type Window = {
  id: string;
  position: [number, number];
  width: number;
  wall_id?: string;
};

type Room = {
  id: string;
  type: string;
  polygon: [number, number][];
  label?: string;
};

type Scale = {
  pixels_per_meter: number;
  reference_length?: number;
  unit?: string;
};

// Add to existing project store
let floorplanAnalysis = $state<FloorplanAnalysisState>({
  loaded: false,
  walls: [],
  doors: [],
  windows: [],
  rooms: [],
  scale: null,
  visible: true // Default: show walls/doors
});

// Loading function
async function loadFloorplanAnalysis(projectId: string) {
  try {
    const response = await fetch(`/api/projects/${projectId}/floorplan-analysis`);
    const result = await response.json();

    if (result.exists) {
      floorplanAnalysis = {
        loaded: true,
        walls: result.data.walls || [],
        doors: result.data.doors || [],
        windows: result.data.windows || [],
        rooms: result.data.rooms || [],
        scale: result.data.scale || null,
        visible: true
      };
    } else {
      floorplanAnalysis = {
        loaded: true,
        walls: [],
        doors: [],
        windows: [],
        rooms: [],
        scale: null,
        visible: false
      };
    }
  } catch (err) {
    console.error('Failed to load floorplan analysis:', err);
  }
}

// Toggle visibility
function toggleWallsDoorsVisibility() {
  floorplanAnalysis.visible = !floorplanAnalysis.visible;
}
```

### 2.2 Export Functions
```typescript
export function getFloorplanAnalysis() {
  return floorplanAnalysis;
}

export function isWallsDoorsVisible() {
  return floorplanAnalysis.visible;
}

export function toggleWallsDoors() {
  toggleWallsDoorsVisibility();
}
```

---

## 🖼️ Phase 3: Canvas Rendering (Konva Layer)

### 3.1 Create WallsDoors Component
**File:** `src/lib/components/canvas/WallsDoorsLayer.svelte`

```svelte
<script lang="ts">
  import { Group, Line, Arc, Circle } from 'svelte-konva';
  import { getFloorplanAnalysis } from '$lib/stores/project.svelte';

  const analysis = $derived(getFloorplanAnalysis());
  const visible = $derived(analysis.visible);

  // Visual styling
  const WALL_COLOR = '#1e293b'; // Slate-800
  const WALL_OPACITY = 0.6;
  const WALL_STROKE_WIDTH = 3;

  const DOOR_COLOR = '#0ea5e9'; // Sky-500
  const DOOR_OPACITY = 0.7;
  const DOOR_STROKE_WIDTH = 2;

  const WINDOW_COLOR = '#06b6d4'; // Cyan-500
  const WINDOW_OPACITY = 0.5;

  // Convert walls to Konva line format
  const wallLines = $derived(
    analysis.walls.map(wall => ({
      id: wall.id,
      points: [...wall.start, ...wall.end],
      stroke: WALL_COLOR,
      strokeWidth: WALL_STROKE_WIDTH,
      opacity: WALL_OPACITY,
      lineCap: 'round',
      lineJoin: 'round'
    }))
  );

  // Render doors as arcs (swing visualization)
  const doorArcs = $derived(
    analysis.doors.map(door => ({
      id: door.id,
      x: door.position[0],
      y: door.position[1],
      innerRadius: 0,
      outerRadius: door.width || 30,
      angle: 90, // 90-degree swing
      stroke: DOOR_COLOR,
      strokeWidth: DOOR_STROKE_WIDTH,
      opacity: DOOR_OPACITY
    }))
  );

  // Render windows as rectangles
  const windowRects = $derived(
    analysis.windows.map(win => ({
      id: win.id,
      x: win.position[0],
      y: win.position[1],
      width: win.width || 20,
      height: 5,
      fill: WINDOW_COLOR,
      opacity: WINDOW_OPACITY
    }))
  );
</script>

{#if visible && analysis.loaded}
  <Group config={{ id: 'walls-doors-layer', listening: false }}>
    <!-- Walls -->
    {#each wallLines as wall (wall.id)}
      <Line config={wall} />
    {/each}

    <!-- Doors -->
    {#each doorArcs as door (door.id)}
      <Arc config={door} />
      <!-- Door hinge point -->
      <Circle
        config={{
          x: door.x,
          y: door.y,
          radius: 3,
          fill: DOOR_COLOR,
          opacity: DOOR_OPACITY
        }}
      />
    {/each}

    <!-- Windows -->
    {#each windowRects as window (window.id)}
      <Circle
        config={{
          x: window.x,
          y: window.y,
          radius: window.width / 2,
          fill: WINDOW_COLOR,
          opacity: WINDOW_OPACITY,
          strokeWidth: 1,
          stroke: WINDOW_COLOR
        }}
      />
    {/each}
  </Group>
{/if}
```

### 3.2 Integrate into FloorplanCanvas
**File:** `src/lib/components/canvas/FloorplanCanvas.svelte`

Add after floorplan image, before items:

```svelte
<script>
  import WallsDoorsLayer from './WallsDoorsLayer.svelte';
  // ... existing imports
</script>

<Stage ...>
  <Layer>
    <!-- 1. Floorplan image -->
    {#if floorplanImage}
      <KonvaImage ... />
    {/if}

    <!-- 2. Walls & Doors (NEW!) -->
    <WallsDoorsLayer />

    <!-- 3. Items -->
    {#each visibleItems as item}
      <ItemShape ... />
    {/each}

    <!-- 4. UI Controls -->
    ...
  </Layer>
</Stage>
```

---

## 🎛️ Phase 4: UI Controls (Toggle Visibility)

### 4.1 Add Toggle Button to Header
**File:** `src/routes/projects/[id]/+page.svelte`

Add next to existing canvas controls:

```svelte
<script>
  import { Eye, EyeOff } from 'lucide-svelte';
  import { toggleWallsDoors, isWallsDoorsVisible } from '$lib/stores/project.svelte';

  const showWallsDoors = $derived(isWallsDoorsVisible());
</script>

<!-- In header toolbar -->
<button
  onclick={() => toggleWallsDoors()}
  class="btn-icon"
  title={showWallsDoors ? 'Hide walls & doors' : 'Show walls & doors'}
>
  {#if showWallsDoors}
    <Eye size={20} />
  {:else}
    <EyeOff size={20} />
  {/if}
  <span class="ml-2">Walls & Doors</span>
</button>
```

### 4.2 Status Indicator
Show when analysis is available:

```svelte
{#if floorplanAnalysis.loaded && floorplanAnalysis.walls.length > 0}
  <div class="badge badge-info">
    AI Analysis: {floorplanAnalysis.walls.length} walls,
    {floorplanAnalysis.doors.length} doors
  </div>
{/if}
```

---

## 🔄 Phase 5: Integration with Item Placement

### 5.1 Collision Detection Helper
**File:** `src/lib/utils/geometry.ts`

```typescript
import type { Wall, Door } from '$lib/stores/project.svelte';

/**
 * Check if an item position intersects with a wall
 */
export function intersectsWall(
  itemX: number,
  itemY: number,
  itemWidth: number,
  itemHeight: number,
  wall: Wall
): boolean {
  // Line-rectangle intersection
  const [x1, y1] = wall.start;
  const [x2, y2] = wall.end;

  // Check if line segment intersects with item bounding box
  return lineIntersectsRect(x1, y1, x2, y2, itemX, itemY, itemWidth, itemHeight);
}

/**
 * Check if an item blocks a door
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

  // Check if item overlaps with door swing arc
  return circleIntersectsRect(dx, dy, doorRadius, itemX, itemY, itemWidth, itemHeight);
}

function lineIntersectsRect(
  x1: number, y1: number,
  x2: number, y2: number,
  rx: number, ry: number,
  rw: number, rh: number
): boolean {
  // Standard line-rectangle intersection algorithm
  // ... implementation
  return false; // Placeholder
}

function circleIntersectsRect(
  cx: number, cy: number, radius: number,
  rx: number, ry: number,
  rw: number, rh: number
): boolean {
  // Circle-rectangle intersection
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const distX = cx - closestX;
  const distY = cy - closestY;
  return (distX * distX + distY * distY) < (radius * radius);
}
```

### 5.2 Visual Feedback on Drag
**File:** `src/lib/components/canvas/ItemShape.svelte`

Show warning when dragging over walls/doors:

```svelte
<script>
  import { intersectsWall, blocksDoor } from '$lib/utils/geometry';
  import { getFloorplanAnalysis } from '$lib/stores/project.svelte';

  const analysis = $derived(getFloorplanAnalysis());

  let hasCollision = $state(false);

  function checkCollisions(x: number, y: number) {
    const walls = analysis.walls;
    const doors = analysis.doors;

    hasCollision = walls.some(wall =>
      intersectsWall(x, y, item.width, item.height, wall)
    ) || doors.some(door =>
      blocksDoor(x, y, item.width, item.height, door)
    );

    return hasCollision;
  }

  function onDragMove(e) {
    const node = e.target;
    const x = node.x();
    const y = node.y();

    checkCollisions(x, y);
    // ... existing drag logic
  }
</script>

<Group
  config={{
    opacity: hasCollision ? 0.5 : 1.0,
    stroke: hasCollision ? '#ef4444' : undefined, // Red border on collision
    strokeWidth: hasCollision ? 3 : 0
  }}
>
  <!-- ... existing item rendering -->
</Group>
```

---

## 📝 Phase 6: AI Integration Prompt

Update MCP tool descriptions to guide AI behavior:

**File:** `src/routes/api/mcp/+server.ts`

```typescript
server.registerTool('update_furniture_item', {
  description: `Update furniture item position.

  IMPORTANT: Before placing furniture:
  1. Call get_floorplan_analysis to retrieve walls and doors
  2. Check that the new position doesn't intersect walls
  3. Ensure the item doesn't block door swing areas
  4. Keep minimum 60cm clearance around doors

  Use the wall start/end points and door positions to validate placement.`,
  // ... rest of schema
});
```

---

## 🎯 Implementation Order

### Sprint 1: Backend + API (1 day)
- [ ] Create `/api/projects/[id]/floorplan-analysis/+server.ts`
- [ ] Test endpoint returns walls/doors correctly
- [ ] Handle missing analysis gracefully

### Sprint 2: Frontend Store (1 day)
- [ ] Extend project store with floorplan analysis state
- [ ] Add load function
- [ ] Add toggle visibility function
- [ ] Test state management

### Sprint 3: Canvas Rendering (2 days)
- [ ] Create `WallsDoorsLayer.svelte` component
- [ ] Render walls as lines
- [ ] Render doors as arcs with hinges
- [ ] Render windows as circles
- [ ] Integrate into `FloorplanCanvas.svelte`
- [ ] Test visual appearance

### Sprint 4: UI Controls (1 day)
- [ ] Add toggle button to header
- [ ] Add status indicator
- [ ] Test on mobile (hide toggle if needed)

### Sprint 5: Collision Detection (2 days)
- [ ] Implement geometry helpers
- [ ] Add collision checking on drag
- [ ] Add visual feedback (red border)
- [ ] Test edge cases

### Sprint 6: AI Guidance (1 day)
- [ ] Update MCP tool descriptions
- [ ] Test AI respects walls/doors
- [ ] Document best practices

**Total: ~8 days**

---

## 🎨 Visual Design

### Colors & Styling
```css
/* Walls */
--wall-color: #1e293b; /* Slate-800 */
--wall-opacity: 0.6;
--wall-width: 3px;

/* Doors */
--door-color: #0ea5e9; /* Sky-500 */
--door-opacity: 0.7;
--door-width: 2px;

/* Windows */
--window-color: #06b6d4; /* Cyan-500 */
--window-opacity: 0.5;

/* Collision warning */
--collision-color: #ef4444; /* Red-500 */
```

### Layering
- Walls/doors should be **below** items (z-index)
- Semi-transparent so items are visible on top
- Disable pointer events (`listening: false`) so they don't intercept clicks

---

## 🧪 Testing Checklist

- [ ] Load project with no analysis → No errors
- [ ] Load project with analysis → Walls/doors render correctly
- [ ] Toggle visibility → Layer shows/hides
- [ ] Drag item over wall → Red border appears
- [ ] Drag item over door → Red border appears
- [ ] Place item in valid space → No warnings
- [ ] Mobile view → Toggle button works
- [ ] Zoom in/out → Walls/doors scale correctly
- [ ] Multiple branches → Analysis is project-wide (not branch-specific)

---

## 🔮 Future Enhancements

### Phase 7: Edit Mode
- Click walls to adjust endpoints
- Click doors to change swing direction
- Manual annotation UI

### Phase 8: Room Highlighting
- Hover over item → Highlight parent room
- Color-code rooms by type
- Show room labels

### Phase 9: 3D Preview
- Use wall data to generate 3D walls
- Show furniture in 3D context
- Export to glTF format

### Phase 10: Smart Suggestions
- AI suggests optimal furniture placement
- Respects walls, doors, traffic flow
- Maximizes space utilization

---

## 📊 Data Structure Summary

```typescript
// Database (floorplan_analyses table)
{
  project_id: UUID,
  data: {
    walls: [{ id, start: [x,y], end: [x,y], thickness }],
    openings: [
      { id, type: 'door'|'window', position: [x,y], width, wall_id }
    ],
    rooms: [{ id, type, polygon: [[x,y],...], label }],
    scale: { pixels_per_meter, unit },
    metadata: { confidence, analyzed_with, notes }
  }
}

// Frontend Store
{
  loaded: boolean,
  visible: boolean,
  walls: Wall[],
  doors: Door[],
  windows: Window[],
  rooms: Room[],
  scale: Scale | null
}

// Canvas Layer
Group {
  id: 'walls-doors-layer',
  listening: false, // Don't intercept clicks
  children: [
    Line[] (walls),
    Arc[] (doors),
    Circle[] (windows)
  ]
}
```

---

## ✅ Success Criteria

1. **Visual**: Walls and doors render clearly on canvas
2. **Performance**: No lag with 50+ walls
3. **UX**: Toggle visibility works smoothly
4. **Collision**: Items show warning when placed incorrectly
5. **AI**: MCP tools guide AI to respect architectural constraints
6. **Mobile**: Works on touch devices

---

## 🚀 Next Steps

After reading this plan, choose one:
1. **Start implementation** - Begin with Sprint 1 (Backend API)
2. **Adjust plan** - Request changes to approach
3. **Prototype first** - Build minimal proof-of-concept

Ready to start building? 🛠️
