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

export interface ResolveItemDisplayPositionInput {
  itemId: string;
  naturalX: number;
  naturalY: number;
  draggingItemId: string | null;
  dragPosition: { x: number; y: number } | null;
  naturalToDisplay: (naturalX: number, naturalY: number) => { x: number; y: number };
}

export interface DistanceIndicatorVisibilityInput {
  isInteractionActive: boolean;
  isDraggingItem: boolean;
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

export function resolveItemDisplayPosition(
  input: ResolveItemDisplayPositionInput
): { x: number; y: number } {
  if (input.draggingItemId === input.itemId && input.dragPosition) {
    return input.dragPosition;
  }

  return input.naturalToDisplay(input.naturalX, input.naturalY);
}

export function shouldShowDistanceIndicators(input: DistanceIndicatorVisibilityInput): boolean {
  if (input.isDraggingItem) return true;
  return !input.isInteractionActive;
}
