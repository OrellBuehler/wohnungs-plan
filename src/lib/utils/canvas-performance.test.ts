import { describe, expect, it } from 'vitest';
import {
  buildDimensionMap,
  getCanvasLabelFontSizes,
  getItemShadowStyle,
  getGridStepCount,
  remToPx,
  resolveItemDisplayPosition,
  shouldEnableItemLayerListening,
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

describe('shouldEnableItemLayerListening', () => {
  it('enables listening when idle', () => {
    expect(
      shouldEnableItemLayerListening({
        isInteractionActive: false,
        isDraggingItem: false,
        isLongPressDragging: false,
      })
    ).toBe(true);
  });

  it('disables listening during pan/zoom interaction', () => {
    expect(
      shouldEnableItemLayerListening({
        isInteractionActive: true,
        isDraggingItem: false,
        isLongPressDragging: false,
      })
    ).toBe(false);
  });

  it('keeps listening enabled while dragging items', () => {
    expect(
      shouldEnableItemLayerListening({
        isInteractionActive: true,
        isDraggingItem: true,
        isLongPressDragging: false,
      })
    ).toBe(true);
    expect(
      shouldEnableItemLayerListening({
        isInteractionActive: true,
        isDraggingItem: false,
        isLongPressDragging: true,
      })
    ).toBe(true);
  });
});

describe('remToPx', () => {
  it('converts rem units with provided root font size', () => {
    expect(remToPx(0.5, 16)).toBe(8);
    expect(remToPx(1.25, 20)).toBe(25);
  });
});

describe('getGridStepCount', () => {
  it('returns enough steps to cover stage plus one trailing line', () => {
    expect(getGridStepCount(800, 50)).toBe(17);
    expect(getGridStepCount(801, 50)).toBe(18);
  });

  it('guards against invalid grid sizes', () => {
    expect(getGridStepCount(200, 0)).toBe(201);
    expect(getGridStepCount(200, -5)).toBe(201);
  });
});

describe('getCanvasLabelFontSizes', () => {
  it('returns larger default item label sizes', () => {
    expect(getCanvasLabelFontSizes({ rootFontPx: 16, mobileMode: false, zoom: 1 })).toEqual({
      itemNamePx: 10,
      itemDimensionsPx: 8,
      distanceLabelPx: 9,
    });
  });

  it('keeps distance labels constant on screen by compensating zoom', () => {
    const sizes = getCanvasLabelFontSizes({ rootFontPx: 16, mobileMode: false, zoom: 2 });
    expect(sizes.distanceLabelPx).toBe(4.5);
  });
});

describe('buildDimensionMap', () => {
  it('builds width/height pixel values for each item id', () => {
    const map = buildDimensionMap(
      [
        { id: 'a', width: 50, height: 30 },
        { id: 'b', width: 80, height: 40 },
      ],
      2.5
    );

    expect(map.get('a')).toEqual({ widthPx: 125, heightPx: 75 });
    expect(map.get('b')).toEqual({ widthPx: 200, heightPx: 100 });
  });

  it('uses a safe fallback scale for invalid inputs', () => {
    const map = buildDimensionMap([{ id: 'x', width: 10, height: 5 }], 0);
    expect(map.get('x')).toEqual({ widthPx: 10, heightPx: 5 });
  });
});
