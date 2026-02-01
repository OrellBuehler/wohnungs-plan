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
    { x: 0, y: height },
  ];

  // Rotate each corner and find bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

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

// Minimum overlap in pixels required to be considered overlapping
const OVERLAP_TOLERANCE = 5;

/**
 * Check if two rectangles overlap, accounting for rotation
 */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  // Get axis-aligned bounding boxes that account for rotation
  const aBox = getRotatedBoundingBox(a.x, a.y, a.width, a.height, a.rotation);
  const bBox = getRotatedBoundingBox(b.x, b.y, b.width, b.height, b.rotation);

  // Check for overlap with tolerance (must overlap by more than OVERLAP_TOLERANCE pixels)
  const overlapX = Math.min(aBox.maxX, bBox.maxX) - Math.max(aBox.minX, bBox.minX);
  const overlapY = Math.min(aBox.maxY, bBox.maxY) - Math.max(aBox.minY, bBox.minY);

  return overlapX > OVERLAP_TOLERANCE && overlapY > OVERLAP_TOLERANCE;
}

export function getOverlappingItems(items: Item[], scale: number): Set<string> {
  const overlapping = new Set<string>();
  const placedItems = items.filter((item) => item.position !== null);

  const rects = placedItems
    .map((item) => ({ item, rect: itemToRect(item, scale)! }));

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
