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

export interface CanvasLabelFontSizeInput {
  rootFontPx: number;
  mobileMode: boolean;
  zoom: number;
}

export interface CanvasLabelFontSizes {
  itemNamePx: number;
  itemDimensionsPx: number;
  distanceLabelPx: number;
}

const BASE_ITEM_NAME_REM = 0.625; // 10px at default browser font size
const BASE_ITEM_DIMENSIONS_REM = 0.5; // 8px
const BASE_DISTANCE_LABEL_REM = 0.5625; // 9px
const MOBILE_SCALE_FACTOR = 1;

export function remToPx(rem: number, rootFontPx: number): number {
  return rem * rootFontPx;
}

export function getCanvasLabelFontSizes(
  input: CanvasLabelFontSizeInput
): CanvasLabelFontSizes {
  const uiScale = input.mobileMode ? MOBILE_SCALE_FACTOR : 1;
  const safeZoom = input.zoom > 0 ? input.zoom : 1;

  const itemNamePx = remToPx(BASE_ITEM_NAME_REM, input.rootFontPx) * uiScale;
  const itemDimensionsPx = remToPx(BASE_ITEM_DIMENSIONS_REM, input.rootFontPx) * uiScale;
  const distanceLabelPx =
    (remToPx(BASE_DISTANCE_LABEL_REM, input.rootFontPx) * uiScale) / safeZoom;

  return {
    itemNamePx,
    itemDimensionsPx,
    distanceLabelPx,
  };
}

export function getGridStepCount(stageSize: number, gridSize: number): number {
  const safeGridSize = Number.isFinite(gridSize) && gridSize > 0 ? gridSize : 1;
  const safeStageSize = Number.isFinite(stageSize) && stageSize > 0 ? stageSize : 0;
  return Math.ceil(safeStageSize / safeGridSize) + 1;
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
