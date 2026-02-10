# Distance Indicators Design

Show distances between selected furniture items and nearby items, displayed as architectural dimension lines.

## Behavior

**When shown:**
- When an item is selected (clicked)
- When an item is being dragged

**What's shown:**
- Distance to the 2 nearest items
- Only if within 4 meters (400cm)
- Measured edge-to-edge (shortest distance between closest points)

## Visual Design

Architectural dimension lines:
```
  ├── 45 cm ──┤
```

Components:
- **Main line**: 1-2px, connects the two closest edge points
- **End caps**: 8px perpendicular lines at each end
- **Label**: Distance in cm, centered, white background pill for readability
- **Color**: Blue or neutral gray (distinct from red overlap warnings)

## Implementation

### New Geometry Function

`src/lib/utils/geometry.ts`:

```typescript
function getMinEdgeDistance(
  boxA: BoundingBox,
  boxB: BoundingBox
): { distance: number; pointA: { x: number; y: number }; pointB: { x: number; y: number } }
```

Returns the shortest edge-to-edge distance and the two connection points.

### Canvas Changes

`src/lib/components/canvas/FloorplanCanvas.svelte`:

**Constants:**
```typescript
const MAX_DISTANCE_CM = 400;  // 4 meters
const MAX_NEIGHBORS = 2;
const END_CAP_LENGTH = 8;     // pixels
```

**Derived state:**
```typescript
const distanceIndicators = $derived.by(() => {
  // 1. Get active item (selected or dragging)
  // 2. Calculate bounding boxes for all placed items
  // 3. Compute edge distances to other items
  // 4. Filter to within MAX_DISTANCE_CM
  // 5. Sort by distance, take MAX_NEIGHBORS nearest
  // 6. Return array of { pointA, pointB, distanceCm }
})
```

**Rendering:**
- New `<Layer>` above items, below alignment guides
- For each indicator:
  - `<Line>` for main connecting line
  - `<Line>` for each end cap (perpendicular)
  - `<Group>` with `<Rect>` + `<Text>` for centered label

**Distance conversion:**
```typescript
distanceCm = distancePixels / (floorplan.scale * displayScale)
```

## Files Changed

1. `src/lib/utils/geometry.ts` - Add `getMinEdgeDistance` function
2. `src/lib/components/canvas/FloorplanCanvas.svelte` - Add derived state and render layer
