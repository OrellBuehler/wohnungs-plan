import { describe, expect, it } from 'vitest';
import {
  getItemShadowStyle,
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
