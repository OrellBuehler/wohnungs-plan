export interface LabelVisibilityInput {
  isInteractionActive: boolean;
  isSelected: boolean;
  isDragging: boolean;
}

export interface ItemShadowStyle {
  blur: number;
  opacity: number;
  offsetX: number;
  offsetY: number;
}

export function shouldRenderGrid(showGrid: boolean, isInteractionActive: boolean): boolean {
  return showGrid && !isInteractionActive;
}

export function shouldRenderItemLabels(input: LabelVisibilityInput): boolean {
  if (!input.isInteractionActive) return true;
  return input.isSelected || input.isDragging;
}

export function getItemShadowStyle(isInteractionActive: boolean): ItemShadowStyle {
  if (isInteractionActive) {
    return {
      blur: 0,
      opacity: 0,
      offsetX: 0,
      offsetY: 0,
    };
  }

  return {
    blur: 10,
    opacity: 0.3,
    offsetX: 4,
    offsetY: 4,
  };
}
