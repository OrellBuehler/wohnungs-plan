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

export interface ItemLayerListeningInput {
  isInteractionActive: boolean;
  isDraggingItem: boolean;
  isLongPressDragging: boolean;
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

export interface ItemDimensionsPx {
  widthPx: number;
  heightPx: number;
}

const BASE_ITEM_NAME_REM = 0.75; // 12px
const BASE_ITEM_DIMENSIONS_REM = 0.5625; // 9px
const MOBILE_ITEM_NAME_REM = 0.5; // 8px
const MOBILE_ITEM_DIMENSIONS_REM = 0.375; // 6px
const BASE_DISTANCE_LABEL_REM = 0.5625; // 9px

export function remToPx(rem: number, rootFontPx: number): number {
  return rem * rootFontPx;
}

export function getCanvasLabelFontSizes(
  input: CanvasLabelFontSizeInput
): CanvasLabelFontSizes {
  const safeZoom = input.zoom > 0 ? input.zoom : 1;

  const nameRem = input.mobileMode ? MOBILE_ITEM_NAME_REM : BASE_ITEM_NAME_REM;
  const dimsRem = input.mobileMode ? MOBILE_ITEM_DIMENSIONS_REM : BASE_ITEM_DIMENSIONS_REM;

  const itemNamePx = remToPx(nameRem, input.rootFontPx);
  const itemDimensionsPx = remToPx(dimsRem, input.rootFontPx);
  const distanceLabelPx = remToPx(BASE_DISTANCE_LABEL_REM, input.rootFontPx) / safeZoom;

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

export function buildIdMap<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

export function buildDimensionMap<T extends { id: string; width: number; height: number }>(
  items: T[],
  pixelsPerCm: number
): Map<string, ItemDimensionsPx> {
  const safePixelsPerCm = Number.isFinite(pixelsPerCm) && pixelsPerCm > 0 ? pixelsPerCm : 1;
  return new Map(
    items.map((item) => [
      item.id,
      {
        widthPx: item.width * safePixelsPerCm,
        heightPx: item.height * safePixelsPerCm,
      },
    ])
  );
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

export function shouldEnableItemLayerListening(input: ItemLayerListeningInput): boolean {
  if (input.isDraggingItem || input.isLongPressDragging) return true;
  return !input.isInteractionActive;
}
