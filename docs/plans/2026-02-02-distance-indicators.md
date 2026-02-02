# Distance Indicators Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show architectural dimension lines between selected furniture items and their 2 nearest neighbors (within 4m), displaying edge-to-edge distances in centimeters.

**Architecture:** Add edge-to-edge distance calculation to geometry utilities, then add derived state in FloorplanCanvas that computes distances when an item is selected or dragged. Render dimension lines in a dedicated Konva layer with main line, end caps, and centered labels.

**Tech Stack:** TypeScript, Svelte 5, Konva.js (svelte-konva)

---

## Task 1: Add Edge Distance Calculation Utility

**Files:**
- Modify: `src/lib/utils/geometry.ts` (add function after `getRotatedBoundingBox` at ~line 136)

**Step 1: Add BoundingBox type and getMinEdgeDistance function**

Add after the `getRotatedBoundingBox` function:

```typescript
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

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
    { start: { x: boxA.minX, y: boxA.maxY }, end: { x: boxA.minX, y: boxA.minY } },
  ];

  const edgesB = [
    { start: { x: boxB.minX, y: boxB.minY }, end: { x: boxB.maxX, y: boxB.minY } },
    { start: { x: boxB.maxX, y: boxB.minY }, end: { x: boxB.maxX, y: boxB.maxY } },
    { start: { x: boxB.maxX, y: boxB.maxY }, end: { x: boxB.minX, y: boxB.maxY } },
    { start: { x: boxB.minX, y: boxB.maxY }, end: { x: boxB.minX, y: boxB.minY } },
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
    pointB: closestPointB,
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
    const dist = Math.sqrt(
      (point.x - segStart.x) ** 2 + (point.y - segStart.y) ** 2
    );
    return { distance: dist, closestPoint: segStart };
  }

  // Find projection of point onto line (parameterized 0-1)
  let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t)); // Clamp to segment

  const closestPoint = {
    x: segStart.x + t * dx,
    y: segStart.y + t * dy,
  };

  const distance = Math.sqrt(
    (point.x - closestPoint.x) ** 2 + (point.y - closestPoint.y) ** 2
  );

  return { distance, closestPoint };
}
```

**Step 2: Type-check the changes**

Run: `bun check`

Expected: Should pass with no errors in geometry.ts

**Step 3: Commit the geometry utility**

```bash
git add src/lib/utils/geometry.ts
git commit -m "feat: add edge-to-edge distance calculation utility"
```

---

## Task 2: Add Distance Indicators to Canvas

**Files:**
- Modify: `src/lib/components/canvas/FloorplanCanvas.svelte`

**Step 1: Add constants after existing constants (after line 67)**

```typescript
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.1;
const ALIGNMENT_THRESHOLD = 5; // pixels

// Distance indicator constants
const MAX_DISTANCE_CM = 400; // 4 meters
const MAX_NEIGHBORS = 2;
const END_CAP_LENGTH = 8; // pixels
```

**Step 2: Import BoundingBox type**

Modify the import from geometry utils (around line 5):

```typescript
import { getOverlappingItems, getItemShapePoints, getRotatedBoundingBox, getMinEdgeDistance, type BoundingBox } from '$lib/utils/geometry';
```

**Step 3: Add derived state for distance indicators**

Add after the `overlappingIds` derived state (around line 398):

```typescript
const overlappingIds = $derived.by(() => {
  return getOverlappingItems(items, effectiveScale);
});

// Distance indicators - show distances to 2 nearest items within 4m
const distanceIndicators = $derived.by(() => {
  // Get the active item (selected or being dragged)
  const activeItemId = draggingItemId ?? selectedItemId;
  if (!activeItemId || !floorplan?.scale) return [];

  const activeItem = items.find(i => i.id === activeItemId);
  if (!activeItem?.position) return [];

  // Convert active item to display coordinates
  const activeDisplayPos = naturalToDisplay(activeItem.position.x, activeItem.position.y);
  const activeWidthPx = cmToPixels(activeItem.width);
  const activeHeightPx = cmToPixels(activeItem.height);
  const activeBox = getRotatedBoundingBox(
    activeDisplayPos.x,
    activeDisplayPos.y,
    activeWidthPx,
    activeHeightPx,
    activeItem.rotation
  );

  // Calculate distances to all other placed items
  const distances = placedItems
    .filter(item => item.id !== activeItemId)
    .map(item => {
      const itemDisplayPos = naturalToDisplay(item.position!.x, item.position!.y);
      const itemWidthPx = cmToPixels(item.width);
      const itemHeightPx = cmToPixels(item.height);
      const itemBox = getRotatedBoundingBox(
        itemDisplayPos.x,
        itemDisplayPos.y,
        itemWidthPx,
        itemHeightPx,
        item.rotation
      );

      const { distance, pointA, pointB } = getMinEdgeDistance(activeBox, itemBox);
      const distanceCm = distance / effectiveScale;

      return {
        item,
        distance,
        distanceCm,
        pointA,
        pointB,
      };
    })
    .filter(d => d.distanceCm <= MAX_DISTANCE_CM)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_NEIGHBORS);

  return distances;
});
```

**Step 4: Type-check the changes**

Run: `bun check`

Expected: Should pass with no errors

**Step 5: Commit the derived state**

```bash
git add src/lib/components/canvas/FloorplanCanvas.svelte
git commit -m "feat: add distance indicators derived state"
```

---

## Task 3: Render Distance Indicators

**Files:**
- Modify: `src/lib/components/canvas/FloorplanCanvas.svelte`

**Step 1: Add distance indicator layer**

Add a new `<Layer>` after the furniture items layer (around line 565, before alignment guides layer):

```svelte
    </Layer>

    <!-- Distance indicators -->
    {#if distanceIndicators.length > 0}
      <Layer>
        {#each distanceIndicators as indicator}
          {@const dx = indicator.pointB.x - indicator.pointA.x}
          {@const dy = indicator.pointB.y - indicator.pointA.y}
          {@const length = Math.sqrt(dx * dx + dy * dy)}
          {@const angle = Math.atan2(dy, dx)}
          {@const midX = (indicator.pointA.x + indicator.pointB.x) / 2}
          {@const midY = (indicator.pointA.y + indicator.pointB.y) / 2}
          {@const labelText = `${Math.round(indicator.distanceCm)} cm`}

          <!-- Main dimension line -->
          <Line
            points={[indicator.pointA.x, indicator.pointA.y, indicator.pointB.x, indicator.pointB.y]}
            stroke="#3B82F6"
            strokeWidth={1.5}
            listening={false}
          />

          <!-- End cap at pointA -->
          <Line
            points={[
              indicator.pointA.x - Math.sin(angle) * END_CAP_LENGTH,
              indicator.pointA.y + Math.cos(angle) * END_CAP_LENGTH,
              indicator.pointA.x + Math.sin(angle) * END_CAP_LENGTH,
              indicator.pointA.y - Math.cos(angle) * END_CAP_LENGTH,
            ]}
            stroke="#3B82F6"
            strokeWidth={1.5}
            listening={false}
          />

          <!-- End cap at pointB -->
          <Line
            points={[
              indicator.pointB.x - Math.sin(angle) * END_CAP_LENGTH,
              indicator.pointB.y + Math.cos(angle) * END_CAP_LENGTH,
              indicator.pointB.x + Math.sin(angle) * END_CAP_LENGTH,
              indicator.pointB.y - Math.cos(angle) * END_CAP_LENGTH,
            ]}
            stroke="#3B82F6"
            strokeWidth={1.5}
            listening={false}
          />

          <!-- Distance label with background -->
          <Group x={midX} y={midY} listening={false}>
            <Rect
              x={-30}
              y={-10}
              width={60}
              height={20}
              fill="white"
              cornerRadius={4}
              shadowColor="black"
              shadowBlur={2}
              shadowOpacity={0.2}
            />
            <Text
              x={-30}
              y={-10}
              width={60}
              height={20}
              text={labelText}
              fontSize={11}
              fontFamily="system-ui, sans-serif"
              fontStyle="bold"
              fill="#3B82F6"
              align="center"
              verticalAlign="middle"
            />
          </Group>
        {/each}
      </Layer>
    {/if}

    <!-- Alignment guides -->
```

**Step 2: Test the feature manually**

Run: `bun dev`

Test steps:
1. Open a project with a floorplan and multiple placed items
2. Click on an item - should see distance indicators to nearest 2 items (if within 4m)
3. Drag an item - indicators should update in real-time
4. Verify distances are displayed in cm and look correct

Expected: Distance indicators appear with blue dimension lines, end caps, and centered labels showing distances in cm

**Step 3: Type-check the changes**

Run: `bun check`

Expected: Should pass with no errors

**Step 4: Commit the rendering layer**

```bash
git add src/lib/components/canvas/FloorplanCanvas.svelte
git commit -m "feat: render distance indicators with dimension lines"
```

---

## Task 4: Visual Polish

**Files:**
- Modify: `src/lib/components/canvas/FloorplanCanvas.svelte`

**Step 1: Adjust label sizing based on text length**

Update the label rendering to dynamically size the background:

```svelte
          <!-- Distance label with background -->
          <Group x={midX} y={midY} listening={false}>
            {@const labelWidth = Math.max(50, labelText.length * 7)}
            <Rect
              x={-labelWidth / 2}
              y={-10}
              width={labelWidth}
              height={20}
              fill="white"
              cornerRadius={4}
              shadowColor="black"
              shadowBlur={2}
              shadowOpacity={0.2}
            />
            <Text
              x={-labelWidth / 2}
              y={-10}
              width={labelWidth}
              height={20}
              text={labelText}
              fontSize={11}
              fontFamily="system-ui, sans-serif"
              fontStyle="bold"
              fill="#3B82F6"
              align="center"
              verticalAlign="middle"
            />
          </Group>
```

**Step 2: Test visual refinements**

Run: `bun dev`

Test steps:
1. Check that labels with different lengths (e.g., "5 cm" vs "123 cm") are properly sized
2. Verify readability against different backgrounds
3. Check that end caps are visible and properly aligned

Expected: Labels are properly sized, readable, and dimension lines look polished

**Step 3: Commit visual polish**

```bash
git add src/lib/components/canvas/FloorplanCanvas.svelte
git commit -m "feat: polish distance indicator label sizing"
```

---

## Final Verification

**Step 1: Full type-check**

Run: `bun check`

Expected: No errors

**Step 2: Manual testing checklist**

Test scenarios:
- [ ] Select item with 0 neighbors → no indicators
- [ ] Select item with 1 neighbor within 4m → 1 indicator
- [ ] Select item with 3+ neighbors within 4m → shows 2 nearest only
- [ ] Select item with neighbors beyond 4m → no indicators
- [ ] Drag item near others → indicators update in real-time
- [ ] Rotate item → indicators remain accurate
- [ ] Zoom in/out → indicators scale correctly
- [ ] Different screen sizes → distances remain accurate (natural coords)

**Step 3: Final commit if any fixes needed**

```bash
git add .
git commit -m "fix: distance indicator edge cases"
```

---

## Summary

**Files Modified:**
1. `src/lib/utils/geometry.ts` - Added `getMinEdgeDistance` and helper functions
2. `src/lib/components/canvas/FloorplanCanvas.svelte` - Added constants, derived state, and rendering layer

**Key Features:**
- Edge-to-edge distance calculation
- Shows 2 nearest neighbors within 4m
- Real-time updates during drag
- Architectural dimension line styling
- Screen-size independent (uses natural coordinates)
