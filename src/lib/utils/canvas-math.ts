export interface ZoomTowardPointInput {
  anchorX: number;
  anchorY: number;
  oldZoom: number;
  newZoom: number;
  panX: number;
  panY: number;
}

export interface ZoomTransform {
  zoom: number;
  panX: number;
  panY: number;
}

export interface ContainerRectLike {
  left: number;
  top: number;
}

export function clampZoom(zoom: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, zoom));
}

export function zoomTowardPoint(input: ZoomTowardPointInput): ZoomTransform {
  const { anchorX, anchorY, oldZoom, newZoom, panX, panY } = input;
  const worldX = (anchorX - panX) / oldZoom;
  const worldY = (anchorY - panY) / oldZoom;

  return {
    zoom: newZoom,
    panX: anchorX - worldX * newZoom,
    panY: anchorY - worldY * newZoom,
  };
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  zoom: number,
  panX: number,
  panY: number
): { x: number; y: number } {
  return {
    x: (screenX - panX) / zoom,
    y: (screenY - panY) / zoom,
  };
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  zoom: number,
  panX: number,
  panY: number
): { x: number; y: number } {
  return {
    x: worldX * zoom + panX,
    y: worldY * zoom + panY,
  };
}

export function getViewportCenterWorld(
  stageWidth: number,
  stageHeight: number,
  zoom: number,
  panX: number,
  panY: number
): { x: number; y: number } {
  return screenToWorld(stageWidth / 2, stageHeight / 2, zoom, panX, panY);
}

export function clientToContainer(
  clientX: number,
  clientY: number,
  containerRect: ContainerRectLike
): { x: number; y: number } {
  return {
    x: clientX - containerRect.left,
    y: clientY - containerRect.top,
  };
}
