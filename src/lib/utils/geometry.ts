import type { Item } from '$lib/types';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export function itemToRect(item: Item, scale: number): Rect | null {
  if (!item.position) return null;
  return {
    x: item.position.x,
    y: item.position.y,
    width: item.width * scale,
    height: item.height * scale,
    rotation: item.rotation,
  };
}

// Simplified AABB collision (ignoring rotation for simplicity)
export function rectsOverlap(a: Rect, b: Rect): boolean {
  // Get axis-aligned bounds (simplified, ignores rotation)
  const aRight = a.x + a.width;
  const aBottom = a.y + a.height;
  const bRight = b.x + b.width;
  const bBottom = b.y + b.height;

  return !(aRight <= b.x || a.x >= bRight || aBottom <= b.y || a.y >= bBottom);
}

export function getOverlappingItems(items: Item[], scale: number): Set<string> {
  const overlapping = new Set<string>();
  const rects = items
    .map((item) => ({ item, rect: itemToRect(item, scale) }))
    .filter((r): r is { item: Item; rect: Rect } => r.rect !== null);

  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (rectsOverlap(rects[i].rect, rects[j].rect)) {
        overlapping.add(rects[i].item.id);
        overlapping.add(rects[j].item.id);
      }
    }
  }

  return overlapping;
}
