import { describe, expect, it } from 'vitest';
import {
  getItemShadowStyle,
  remToPx,
  resolveItemDisplayPosition,
  shouldShowDistanceIndicators,
  shouldRenderGrid,
  shouldRenderItemLabels,
} from '$lib/utils/canvas-performance';

describe('shouldRenderGrid', () => {
  it('renders grid only when enabled and not in active interaction mode', () => {
    expect(shouldRenderGrid(true, false)).toBe(true);
    expect(shouldRenderGrid(true, true)).toBe(false);
    expect(shouldRenderGrid(false, false)).toBe(false);
  });
});

describe('shouldRenderItemLabels', () => {
  it('keeps labels visible when not interacting', () => {
    expect(
      shouldRenderItemLabels({
        isInteractionActive: false,
        isSelected: false,
        isDragging: false,
      })
    ).toBe(true);
  });

  it('keeps active item labels visible during interaction', () => {
    expect(
      shouldRenderItemLabels({
        isInteractionActive: true,
        isSelected: true,
        isDragging: false,
      })
    ).toBe(true);
    expect(
      shouldRenderItemLabels({
        isInteractionActive: true,
        isSelected: false,
        isDragging: true,
      })
    ).toBe(true);
  });

  it('hides non-active labels during interaction', () => {
    expect(
      shouldRenderItemLabels({
        isInteractionActive: true,
        isSelected: false,
        isDragging: false,
      })
    ).toBe(false);
  });
});

describe('getItemShadowStyle', () => {
  it('returns reduced shadows during active interaction', () => {
    expect(getItemShadowStyle(true)).toEqual({
      blur: 0,
      opacity: 0,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it('returns full shadows when idle', () => {
    expect(getItemShadowStyle(false)).toEqual({
      blur: 10,
      opacity: 0.3,
      offsetX: 4,
      offsetY: 4,
    });
  });
});

describe('resolveItemDisplayPosition', () => {
  it('uses drag position for the actively dragged item', () => {
    const pos = resolveItemDisplayPosition({
      itemId: 'a',
      naturalX: 20,
      naturalY: 30,
      draggingItemId: 'a',
      dragPosition: { x: 300, y: 400 },
      naturalToDisplay: (x, y) => ({ x: x * 2, y: y * 2 }),
    });

    expect(pos).toEqual({ x: 300, y: 400 });
  });

  it('uses transformed natural position for non-dragged items', () => {
    const pos = resolveItemDisplayPosition({
      itemId: 'b',
      naturalX: 20,
      naturalY: 30,
      draggingItemId: 'a',
      dragPosition: { x: 300, y: 400 },
      naturalToDisplay: (x, y) => ({ x: x * 2, y: y * 2 }),
    });

    expect(pos).toEqual({ x: 40, y: 60 });
  });
});

describe('shouldShowDistanceIndicators', () => {
  it('shows indicators when idle', () => {
    expect(
      shouldShowDistanceIndicators({ isInteractionActive: false, isDraggingItem: false })
    ).toBe(true);
  });

  it('hides indicators during pan/zoom interaction', () => {
    expect(
      shouldShowDistanceIndicators({ isInteractionActive: true, isDraggingItem: false })
    ).toBe(false);
  });

  it('keeps indicators visible while dragging an item', () => {
    expect(
      shouldShowDistanceIndicators({ isInteractionActive: true, isDraggingItem: true })
    ).toBe(true);
  });
});

describe('remToPx', () => {
  it('converts rem units with provided root font size', () => {
    expect(remToPx(0.5, 16)).toBe(8);
    expect(remToPx(1.25, 20)).toBe(25);
  });
});
