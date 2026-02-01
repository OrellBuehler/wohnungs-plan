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
      return [
        0, 0,
        width - cw, 0,
        width - cw, ch,
        width, ch,
        width, height,
        0, height,
      ];
    case 'top-left':
      // L-shape with top-left corner cut out
      return [
        cw, 0,
        width, 0,
        width, height,
        0, height,
        0, ch,
        cw, ch,
      ];
    case 'bottom-right':
      // L-shape with bottom-right corner cut out
      return [
        0, 0,
        width, 0,
        width, height - ch,
        width - cw, height - ch,
        width - cw, height,
        0, height,
      ];
    case 'bottom-left':
      // L-shape with bottom-left corner cut out
      return [
        0, 0,
        width, 0,
        width, height,
        cw, height,
        cw, height - ch,
        0, height - ch,
      ];
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
