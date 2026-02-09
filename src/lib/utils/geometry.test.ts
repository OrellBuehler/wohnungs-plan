import { describe, expect, it } from 'vitest';
import {
  collectPotentialOverlapPairs,
  getOverlappingItems,
  selectNearestByDistance,
  getLShapePoints,
  getRectPoints,
  getItemShapePoints,
  getRotatedBoundingBox,
  getMinEdgeDistance,
  rectsOverlap,
  intersectsWall,
  blocksDoor,
  blocksWindow,
  hasArchitecturalCollision,
  type BoundingBox
} from '$lib/utils/geometry';
import type { Item } from '$lib/types';

function makeItem(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation = 0
): Item {
  return {
    id,
    name: id,
    width,
    height,
    color: '#000000',
    price: null,
    priceCurrency: 'EUR',
    productUrl: null,
    position: { x, y },
    rotation,
    shape: 'rectangle',
  };
}

describe('collectPotentialOverlapPairs', () => {
  it('finds candidate pairs sharing at least one spatial cell', () => {
    const boxes: BoundingBox[] = [
      { minX: 0, minY: 0, maxX: 40, maxY: 40 },
      { minX: 30, minY: 30, maxX: 90, maxY: 90 },
      { minX: 220, minY: 220, maxX: 260, maxY: 260 },
    ];

    const pairs = collectPotentialOverlapPairs(boxes, 64);

    expect(pairs).toContainEqual([0, 1]);
    expect(pairs).not.toContainEqual([0, 2]);
    expect(pairs).not.toContainEqual([1, 2]);
  });

  it('deduplicates pairs for boxes spanning multiple cells', () => {
    const boxes: BoundingBox[] = [
      { minX: 0, minY: 0, maxX: 130, maxY: 130 },
      { minX: 60, minY: 60, maxX: 100, maxY: 100 },
    ];

    const pairs = collectPotentialOverlapPairs(boxes, 64);

    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toEqual([0, 1]);
  });
});

describe('getOverlappingItems', () => {
  it('returns only overlapping item ids', () => {
    const items: Item[] = [
      makeItem('a', 0, 0, 100, 100, 0),
      makeItem('b', 40, 40, 100, 100, 0),
      makeItem('c', 300, 300, 100, 100, 0),
      { ...makeItem('d', 0, 0, 100, 100, 0), position: null },
    ];

    const overlaps = getOverlappingItems(items, 1);

    expect(overlaps.has('a')).toBe(true);
    expect(overlaps.has('b')).toBe(true);
    expect(overlaps.has('c')).toBe(false);
    expect(overlaps.has('d')).toBe(false);
  });
});

describe('selectNearestByDistance', () => {
  it('returns nearest values sorted by distance', () => {
    const nearest = selectNearestByDistance(
      [
        { id: 'a', distance: 12 },
        { id: 'b', distance: 4 },
        { id: 'c', distance: 8 },
        { id: 'd', distance: 1 },
      ],
      2
    );

    expect(nearest).toEqual([
      { id: 'd', distance: 1 },
      { id: 'b', distance: 4 },
    ]);
  });

  it('returns empty for non-positive limits', () => {
    expect(selectNearestByDistance([{ id: 'a', distance: 1 }], 0)).toEqual([]);
  });
});

// --- New tests below ---

describe('getLShapePoints', () => {
  it('returns 12 values (6 points) for top-right cutout', () => {
    const pts = getLShapePoints(100, 80, 30, 20, 'top-right');
    expect(pts).toHaveLength(12);
    // First point is origin
    expect(pts[0]).toBe(0);
    expect(pts[1]).toBe(0);
  });

  it('returns 12 values for top-left cutout', () => {
    const pts = getLShapePoints(100, 80, 30, 20, 'top-left');
    expect(pts).toHaveLength(12);
    // First point starts at cutout width
    expect(pts[0]).toBe(30);
    expect(pts[1]).toBe(0);
  });

  it('returns 12 values for bottom-right cutout', () => {
    const pts = getLShapePoints(100, 80, 30, 20, 'bottom-right');
    expect(pts).toHaveLength(12);
  });

  it('returns 12 values for bottom-left cutout', () => {
    const pts = getLShapePoints(100, 80, 30, 20, 'bottom-left');
    expect(pts).toHaveLength(12);
  });

  it('clamps cutout to not exceed bounds', () => {
    // cutoutWidth=200 > width=100, should clamp to 99 (width - 1)
    const pts = getLShapePoints(100, 80, 200, 200, 'top-right');
    expect(pts).toHaveLength(12);
    // width - cw should be 100 - 99 = 1
    expect(pts[2]).toBe(1);
  });
});

describe('getRectPoints', () => {
  it('returns 4 corners as flat array', () => {
    const pts = getRectPoints(100, 50);
    expect(pts).toEqual([0, 0, 100, 0, 100, 50, 0, 50]);
  });
});

describe('getItemShapePoints', () => {
  it('returns rectangle points for rectangle items', () => {
    const item: Item = {
      ...makeItem('a', 0, 0, 100, 50),
      shape: 'rectangle'
    };
    const pts = getItemShapePoints(item, 1);
    expect(pts).toEqual([0, 0, 100, 0, 100, 50, 0, 50]);
  });

  it('returns L-shape points for l-shape items', () => {
    const item: Item = {
      ...makeItem('a', 0, 0, 100, 80),
      shape: 'l-shape',
      cutoutWidth: 30,
      cutoutHeight: 20,
      cutoutCorner: 'top-right'
    };
    const pts = getItemShapePoints(item, 1);
    expect(pts).toHaveLength(12);
  });

  it('applies scale to dimensions', () => {
    const item: Item = makeItem('a', 0, 0, 100, 50);
    const pts = getItemShapePoints(item, 2);
    expect(pts).toEqual([0, 0, 200, 0, 200, 100, 0, 100]);
  });

  it('falls back to rectangle when l-shape fields are missing', () => {
    const item: Item = {
      ...makeItem('a', 0, 0, 100, 50),
      shape: 'l-shape'
      // missing cutoutWidth, cutoutHeight, cutoutCorner
    };
    const pts = getItemShapePoints(item, 1);
    expect(pts).toEqual([0, 0, 100, 0, 100, 50, 0, 50]);
  });
});

describe('getRotatedBoundingBox', () => {
  it('returns simple bounds for 0° rotation', () => {
    const bb = getRotatedBoundingBox(10, 20, 100, 50, 0);
    expect(bb).toEqual({ minX: 10, minY: 20, maxX: 110, maxY: 70 });
  });

  it('swaps dimensions for 90° rotation', () => {
    const bb = getRotatedBoundingBox(0, 0, 100, 50, 90);
    // At 90°, width goes vertical and height goes horizontal
    expect(bb.minX).toBeCloseTo(-50, 0);
    expect(bb.minY).toBeCloseTo(0, 0);
    expect(bb.maxX).toBeCloseTo(0, 0);
    expect(bb.maxY).toBeCloseTo(100, 0);
  });

  it('expands bounds for 45° rotation', () => {
    const bb = getRotatedBoundingBox(0, 0, 100, 100, 45);
    // A square rotated 45° has a larger bounding box
    const diag = 100 * Math.SQRT2;
    expect(bb.maxX - bb.minX).toBeCloseTo(diag, 0);
    expect(bb.maxY - bb.minY).toBeCloseTo(diag, 0);
  });
});

describe('getMinEdgeDistance', () => {
  it('returns 0 for adjacent (touching) boxes', () => {
    const a: BoundingBox = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const b: BoundingBox = { minX: 10, minY: 0, maxX: 20, maxY: 10 };
    const { distance } = getMinEdgeDistance(a, b);
    expect(distance).toBeCloseTo(0, 5);
  });

  it('returns small distance for overlapping boxes (edge-to-edge metric)', () => {
    // getMinEdgeDistance computes min distance between edges of both boxes
    // For overlapping boxes, edges still have a measurable distance
    const a: BoundingBox = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const b: BoundingBox = { minX: 5, minY: 5, maxX: 15, maxY: 15 };
    const { distance } = getMinEdgeDistance(a, b);
    expect(distance).toBeLessThanOrEqual(10);
  });

  it('returns correct distance for distant boxes', () => {
    const a: BoundingBox = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const b: BoundingBox = { minX: 20, minY: 0, maxX: 30, maxY: 10 };
    const { distance } = getMinEdgeDistance(a, b);
    expect(distance).toBeCloseTo(10, 5);
  });
});

describe('rectsOverlap', () => {
  it('detects overlapping rects', () => {
    const a = { x: 0, y: 0, width: 100, height: 100, rotation: 0 };
    const b = { x: 50, y: 50, width: 100, height: 100, rotation: 0 };
    expect(rectsOverlap(a, b)).toBe(true);
  });

  it('returns false for rects within tolerance', () => {
    // Overlap of exactly 5px should NOT count (needs > 5)
    const a = { x: 0, y: 0, width: 100, height: 100, rotation: 0 };
    const b = { x: 95, y: 95, width: 100, height: 100, rotation: 0 };
    expect(rectsOverlap(a, b)).toBe(false);
  });

  it('returns false for separated rects', () => {
    const a = { x: 0, y: 0, width: 50, height: 50, rotation: 0 };
    const b = { x: 200, y: 200, width: 50, height: 50, rotation: 0 };
    expect(rectsOverlap(a, b)).toBe(false);
  });
});

// Wall/Door/Window types compatible with the project store
type Wall = { id: string; start: [number, number]; end: [number, number]; thickness?: number };
type Door = { id: string; type: 'door'; position: [number, number]; width: number; wall_id?: string };
type Window = { id: string; type: 'window'; position: [number, number]; width: number; wall_id?: string };

describe('intersectsWall', () => {
  it('detects wall crossing through item', () => {
    const wall: Wall = { id: 'w1', start: [50, 0], end: [50, 200] };
    expect(intersectsWall(0, 0, 100, 100, wall)).toBe(true);
  });

  it('returns false when wall is outside item', () => {
    const wall: Wall = { id: 'w1', start: [200, 0], end: [200, 100] };
    expect(intersectsWall(0, 0, 100, 100, wall)).toBe(false);
  });

  it('detects wall with endpoint inside item', () => {
    const wall: Wall = { id: 'w1', start: [50, 50], end: [200, 200] };
    expect(intersectsWall(0, 0, 100, 100, wall)).toBe(true);
  });
});

describe('blocksDoor', () => {
  it('detects item inside door radius', () => {
    const door: Door = { id: 'd1', type: 'door', position: [50, 50], width: 40 };
    expect(blocksDoor(40, 40, 30, 30, door)).toBe(true);
  });

  it('returns false when item is outside door radius', () => {
    const door: Door = { id: 'd1', type: 'door', position: [50, 50], width: 30 };
    expect(blocksDoor(200, 200, 30, 30, door)).toBe(false);
  });
});

describe('blocksWindow', () => {
  it('detects collision with window on vertical wall', () => {
    const wall: Wall = { id: 'w1', start: [100, 0], end: [100, 200] };
    const win: Window = { id: 'win1', type: 'window', position: [100, 100], width: 40, wall_id: 'w1' };
    // Item right at window position
    expect(blocksWindow(95, 85, 20, 30, win, [wall])).toBe(true);
  });

  it('detects collision with window on horizontal wall', () => {
    const wall: Wall = { id: 'w1', start: [0, 100], end: [200, 100] };
    const win: Window = { id: 'win1', type: 'window', position: [100, 100], width: 40, wall_id: 'w1' };
    expect(blocksWindow(85, 95, 30, 20, win, [wall])).toBe(true);
  });

  it('uses square zone when no wall is provided', () => {
    const win: Window = { id: 'win1', type: 'window', position: [100, 100], width: 40 };
    // Item overlapping the square zone
    expect(blocksWindow(85, 85, 30, 30, win)).toBe(true);
    // Item far away
    expect(blocksWindow(200, 200, 10, 10, win)).toBe(false);
  });
});

describe('hasArchitecturalCollision', () => {
  it('returns true when item intersects a wall', () => {
    const wall: Wall = { id: 'w1', start: [50, 0], end: [50, 200] };
    expect(hasArchitecturalCollision(0, 0, 100, 100, [wall], [], [])).toBe(true);
  });

  it('returns true when item blocks a door', () => {
    const door: Door = { id: 'd1', type: 'door', position: [50, 50], width: 40 };
    expect(hasArchitecturalCollision(40, 40, 30, 30, [], [door], [])).toBe(true);
  });

  it('returns true when item blocks a window', () => {
    const win: Window = { id: 'win1', type: 'window', position: [50, 50], width: 40 };
    expect(hasArchitecturalCollision(35, 35, 30, 30, [], [], [win])).toBe(true);
  });

  it('returns false when no collisions', () => {
    const wall: Wall = { id: 'w1', start: [200, 0], end: [200, 100] };
    const door: Door = { id: 'd1', type: 'door', position: [200, 200], width: 30 };
    const win: Window = { id: 'win1', type: 'window', position: [200, 200], width: 20 };
    expect(hasArchitecturalCollision(0, 0, 50, 50, [wall], [door], [win])).toBe(false);
  });
});
