import { describe, expect, it } from 'vitest';
import {
  collectPotentialOverlapPairs,
  getOverlappingItems,
  selectNearestByDistance,
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
