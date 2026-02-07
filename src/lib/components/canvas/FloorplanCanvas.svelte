<script lang="ts">
  import { Stage, Layer, Shape, Image as KonvaImage, Rect, Line, Text, Group } from 'svelte-konva';
  import type { Item, Floorplan } from '$lib/types';
  import type Konva from 'konva';
  import type { Context } from 'konva/lib/Context';
  import type { Shape as KonvaShape } from 'konva/lib/Shape';
  import {
    getMinEdgeDistance,
    getOverlappingItems,
    getItemShapePoints,
    getRotatedBoundingBox,
    selectNearestByDistance,
    type BoundingBox
  } from '$lib/utils/geometry';
  import {
    buildDimensionMap,
    buildIdMap,
    getCanvasLabelFontSizes,
    getItemShadowStyle,
    getGridStepCount,
    resolveItemDisplayPosition,
    shouldEnableItemLayerListening,
    shouldShowDistanceIndicators,
    shouldRenderGrid,
    shouldRenderItemLabels
  } from '$lib/utils/canvas-performance';
  import {
    applyCoalescedPanAndZoom,
    clampZoom,
    clientToContainer,
    getViewportCenterWorld,
    zoomTowardPoint
  } from '$lib/utils/canvas-math';
  import { Button } from '$lib/components/ui/button';
  import { Plus, Minus, RotateCcw, RotateCw, Lock, Unlock, RefreshCw, MapPinOff } from 'lucide-svelte';

  interface Props {
    floorplan: Floorplan | null;
    items: Item[];
    selectedItemId: string | null;
    gridSize: number;
    showGrid: boolean;
    snapToGrid: boolean;
    mobileMode?: boolean;
    onItemSelect: (id: string | null) => void;
    onItemMove: (id: string, x: number, y: number) => void;
    onItemRotate: (id: string, rotation: number) => void;
    onItemUnplace: (id: string) => void;
    onThumbnailReady?: (dataUrl: string) => void;
  }

  let {
    floorplan,
    items,
    selectedItemId,
    gridSize = 50,
    showGrid = true,
    snapToGrid = true,
    mobileMode = false,
    onItemSelect,
    onItemMove,
    onItemRotate,
    onItemUnplace,
    onThumbnailReady,
  }: Props = $props();

  let containerEl: HTMLDivElement;
  let stageRef: { node: Konva.Stage } | undefined = $state();
  let stageWidth = $state(800);
  let stageHeight = $state(600);
  let floorplanImage: HTMLImageElement | null = $state(null);
  let imageNaturalWidth = $state(0);
  let imageNaturalHeight = $state(0);

  // Zoom and pan state
  let zoom = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let isPanning = $state(false);
  let lastPanPoint = $state<{ x: number; y: number } | null>(null);
  let zoomLocked = $state(false);
  let isInteractionActive = $state(false);

  // Coalesced desktop interaction state (applied once per animation frame)
  let pendingPanDeltaX = 0;
  let pendingPanDeltaY = 0;
  let pendingWheelSteps = 0;
  let pendingWheelAnchorX: number | null = null;
  let pendingWheelAnchorY: number | null = null;
  let interactionFrameId: number | null = null;

  // Touch gesture state
  let pointers = $state(new Map<number, { x: number; y: number }>());
  let lastPinchDistance = $state(0);
  let lastPinchCenter = $state<{ x: number; y: number } | null>(null);
  let isPinching = $state(false);

  // Long-press state for mobile item dragging
  let longPressTimer = $state<ReturnType<typeof setTimeout> | null>(null);
  let longPressItemId = $state<string | null>(null);
  let isLongPressDragging = $state(false);
  let longPressStartPoint = $state<{ x: number; y: number } | null>(null);
  const LONG_PRESS_DURATION = 300; // ms
  const LONG_PRESS_MOVE_THRESHOLD = 10; // px - cancel if finger moves too much

  // Clean up long-press timer on component unmount
  $effect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
      if (interactionFrameId !== null) {
        cancelAnimationFrame(interactionFrameId);
      }
      if (interactionIdleTimeout) {
        clearTimeout(interactionIdleTimeout);
      }
    };
  });

  // Alignment guides state
  let alignmentGuides = $state<{ type: 'h' | 'v'; pos: number }[]>([]);
  let draggingItemId = $state<string | null>(null);
  let dragPosition = $state<{ x: number; y: number } | null>(null);

  // Context menu state
  let contextMenuOpen = $state(false);
  let contextMenuItemId = $state<string | null>(null);
  let contextMenuPosition = $state({ x: 0, y: 0 });

  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 5;
  const ZOOM_STEP = 0.1;
  const ALIGNMENT_THRESHOLD = 5; // pixels

  // Distance indicator constants
  const MAX_DISTANCE_CM = 400; // 4 meters
  const MAX_NEIGHBORS = 2;
  const END_CAP_LENGTH = 8; // pixels
  const INTERACTION_IDLE_MS = 120;

  // Label font sizes respect browser root font settings for accessibility.
  let rootFontPx = $state(16);

  $effect(() => {
    if (typeof window === 'undefined') return;

    const updateRootFontPx = () => {
      const value = parseFloat(getComputedStyle(document.documentElement).fontSize);
      if (Number.isFinite(value) && value > 0) {
        rootFontPx = value;
      }
    };

    updateRootFontPx();
    window.addEventListener('resize', updateRootFontPx);
    return () => window.removeEventListener('resize', updateRootFontPx);
  });

  const labelFontSizes = $derived(
    getCanvasLabelFontSizes({
      rootFontPx,
      mobileMode,
      zoom,
    })
  );
  // World-space labels should scale naturally with stage zoom.
  const itemNameFontSize = $derived(labelFontSizes.itemNamePx);
  const itemDimensionsFontSize = $derived(labelFontSizes.itemDimensionsPx);
  // HUD labels compensate for stage zoom to remain constant on screen.
  const distanceLabelFontSize = $derived(labelFontSizes.distanceLabelPx);

  // Load floorplan image
  $effect(() => {
    if (floorplan?.imageData) {
      const img = new Image();
      img.onload = () => {
        imageNaturalWidth = img.naturalWidth;
        imageNaturalHeight = img.naturalHeight;
        floorplanImage = img;
      };
      img.src = floorplan.imageData;
    } else {
      floorplanImage = null;
      imageNaturalWidth = 0;
      imageNaturalHeight = 0;
    }
  });

  // Calculate image dimensions maintaining aspect ratio
  const imageDimensions = $derived.by(() => {
    if (!imageNaturalWidth || !imageNaturalHeight) {
      return { width: stageWidth, height: stageHeight, x: 0, y: 0 };
    }

    const imageAspect = imageNaturalWidth / imageNaturalHeight;
    const stageAspect = stageWidth / stageHeight;

    let width: number;
    let height: number;

    if (imageAspect > stageAspect) {
      width = stageWidth;
      height = stageWidth / imageAspect;
    } else {
      height = stageHeight;
      width = stageHeight * imageAspect;
    }

    const x = (stageWidth - width) / 2;
    const y = (stageHeight - height) / 2;

    return { width, height, x, y };
  });

  // Resize observer
  $effect(() => {
    if (containerEl) {
      const observer = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        stageWidth = width;
        stageHeight = height;
      });
      observer.observe(containerEl);
      return () => observer.disconnect();
    }
  });

  function snapValue(value: number): number {
    if (!snapToGrid) return value;
    return Math.round(value / gridSize) * gridSize;
  }

  function handleStageClick(e: { target: Konva.Node }) {
    if (e.target.getClassName() === 'Stage') {
      onItemSelect(null);
    }
  }

  function handleDragEnd(itemId: string, e: { target: Konva.Node }) {
    const node = e.target;
    const displayX = snapValue(node.x());
    const displayY = snapValue(node.y());
    node.x(displayX);
    node.y(displayY);
    // Convert to natural image coordinates for storage (screen-size independent)
    const natural = displayToNatural(displayX, displayY);
    onItemMove(itemId, natural.x, natural.y);
    draggingItemId = null;
    dragPosition = null;
    alignmentGuides = [];
  }

  function handleDragStart(itemId: string) {
    draggingItemId = itemId;
  }

  function handleDragMove(itemId: string, e: { target: Konva.Node }) {
    const node = e.target;
    const dragX = node.x();
    const dragY = node.y();

    // Track current drag position for distance indicators
    dragPosition = { x: dragX, y: dragY };

    const draggedItem = itemsById.get(itemId);
    if (!draggedItem) return;
    const draggedDimensions = itemDimensionsPxById.get(itemId);
    if (!draggedDimensions) return;

    const dragW = draggedDimensions.widthPx;
    const dragH = draggedDimensions.heightPx;

    // Get rotated bounding box for dragged item
    const dragBox = getRotatedBoundingBox(dragX, dragY, dragW, dragH, draggedItem.rotation);
    const dragCenterX = (dragBox.minX + dragBox.maxX) / 2;
    const dragCenterY = (dragBox.minY + dragBox.maxY) / 2;

    const guides: { type: 'h' | 'v'; pos: number }[] = [];
    let snapX: number | null = null;
    let snapY: number | null = null;

    for (const other of placedItems) {
      if (other.id === itemId) continue;
      const otherDimensions = itemDimensionsPxById.get(other.id);
      if (!otherDimensions) continue;

      const otherW = otherDimensions.widthPx;
      const otherH = otherDimensions.heightPx;

      // Convert other item's natural coordinates to display coordinates for alignment
      const otherDisplayPos = naturalToDisplay(other.position!.x, other.position!.y);

      // Get rotated bounding box for other item
      const otherBox = getRotatedBoundingBox(otherDisplayPos.x, otherDisplayPos.y, otherW, otherH, other.rotation);
      const otherCenterX = (otherBox.minX + otherBox.maxX) / 2;
      const otherCenterY = (otherBox.minY + otherBox.maxY) / 2;

      // Check vertical alignments (x positions) using bounding box edges
      const vChecks = [
        { drag: dragBox.minX, other: otherBox.minX, offset: dragBox.minX - dragX },
        { drag: dragBox.minX, other: otherBox.maxX, offset: dragBox.minX - dragX },
        { drag: dragBox.maxX, other: otherBox.minX, offset: dragBox.maxX - dragX },
        { drag: dragBox.maxX, other: otherBox.maxX, offset: dragBox.maxX - dragX },
        { drag: dragCenterX, other: otherCenterX, offset: dragCenterX - dragX },
      ];

      for (const check of vChecks) {
        if (Math.abs(check.drag - check.other) < ALIGNMENT_THRESHOLD) {
          guides.push({ type: 'v', pos: check.other });
          if (snapX === null) snapX = dragX + (check.other - check.drag);
        }
      }

      // Check horizontal alignments (y positions) using bounding box edges
      const hChecks = [
        { drag: dragBox.minY, other: otherBox.minY, offset: dragBox.minY - dragY },
        { drag: dragBox.minY, other: otherBox.maxY, offset: dragBox.minY - dragY },
        { drag: dragBox.maxY, other: otherBox.minY, offset: dragBox.maxY - dragY },
        { drag: dragBox.maxY, other: otherBox.maxY, offset: dragBox.maxY - dragY },
        { drag: dragCenterY, other: otherCenterY, offset: dragCenterY - dragY },
      ];

      for (const check of hChecks) {
        if (Math.abs(check.drag - check.other) < ALIGNMENT_THRESHOLD) {
          guides.push({ type: 'h', pos: check.other });
          if (snapY === null) snapY = dragY + (check.other - check.drag);
        }
      }
    }

    // Snap to alignment if found
    if (snapX !== null) node.x(snapX);
    if (snapY !== null) node.y(snapY);

    alignmentGuides = guides;
  }

  function handleRotate(itemId: string, direction: 'cw' | 'ccw') {
    const item = itemsById.get(itemId);
    if (item) {
      const delta = direction === 'cw' ? 90 : -90;
      const newRotation = (item.rotation + delta + 360) % 360;
      onItemRotate(itemId, newRotation);
    }
  }

  function handleItemContextMenu(itemId: string, e: { evt: MouseEvent }) {
    e.evt.preventDefault();
    contextMenuItemId = itemId;
    contextMenuPosition = { x: e.evt.clientX, y: e.evt.clientY };
    contextMenuOpen = true;
    onItemSelect(itemId);
  }

  function handleContextMenuAction(action: 'rotate-cw' | 'rotate-ccw' | 'unplace') {
    if (!contextMenuItemId) return;

    switch (action) {
      case 'rotate-cw':
        handleRotate(contextMenuItemId, 'cw');
        break;
      case 'rotate-ccw':
        handleRotate(contextMenuItemId, 'ccw');
        break;
      case 'unplace':
        onItemUnplace(contextMenuItemId);
        break;
    }
    contextMenuOpen = false;
  }

  // Close context menu on Escape
  $effect(() => {
    if (contextMenuOpen) {
      function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
          contextMenuOpen = false;
        }
      }
      document.addEventListener('keydown', handleKeydown);
      return () => document.removeEventListener('keydown', handleKeydown);
    }
  });

  // Zoom functions
  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    if (zoomLocked) return;

    const stage = stageRef?.node;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    pendingWheelSteps += e.deltaY < 0 ? 1 : -1;
    pendingWheelAnchorX = pointer.x;
    pendingWheelAnchorY = pointer.y;
    markInteractionActive();
    scheduleInteractionFrame();
  }

  function zoomIn() {
    const centerX = stageWidth / 2;
    const centerY = stageHeight / 2;
    const newZoom = clampZoom(zoom + ZOOM_STEP * 2, MIN_ZOOM, MAX_ZOOM);
    const result = zoomTowardPoint({
      anchorX: centerX,
      anchorY: centerY,
      oldZoom: zoom,
      newZoom,
      panX,
      panY,
    });
    zoom = result.zoom;
    panX = result.panX;
    panY = result.panY;
  }

  function zoomOut() {
    const centerX = stageWidth / 2;
    const centerY = stageHeight / 2;
    const newZoom = clampZoom(zoom - ZOOM_STEP * 2, MIN_ZOOM, MAX_ZOOM);
    const result = zoomTowardPoint({
      anchorX: centerX,
      anchorY: centerY,
      oldZoom: zoom,
      newZoom,
      panX,
      panY,
    });
    zoom = result.zoom;
    panX = result.panX;
    panY = result.panY;
  }

  function resetView() {
    zoom = 1;
    panX = 0;
    panY = 0;
  }

  function handlePointerDown(e: PointerEvent) {
    // Don't interfere with item dragging on desktop
    if (e.pointerType === 'mouse') return;

    const stage = stageRef?.node;
    if (!stage) return;

    const rect = containerEl.getBoundingClientRect();
    const point = clientToContainer(e.clientX, e.clientY, rect);
    pointers.set(e.pointerId, point);

    // If we now have 2 pointers, start pinch
    if (pointers.size === 2) {
      isPinching = true;
      isPanning = false;
      cancelLongPress();

      const [p1, p2] = Array.from(pointers.values());
      const distance = Math.sqrt(
        Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
      );
      lastPinchDistance = distance;
      lastPinchCenter = {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2
      };
    } else if (pointers.size === 1 && mobileMode) {
      // Check if touch landed on an item - start long-press timer
      const stageNode = stageRef?.node;
      if (stageNode) {
        const pos = stageNode.getPointerPosition();
        if (pos) {
          const shape = stageNode.getIntersection(pos);
          if (shape) {
            // Walk up to find the Group (item container)
            let node: Konva.Node | null = shape;
            while (node && node.getClassName() !== 'Group') {
              node = node.parent;
            }
            if (node && node.getClassName() === 'Group') {
              // Extract item ID from the Group's name attribute (set as "item-{id}")
              const groupName = node.name();
              if (groupName?.startsWith('item-')) {
                const itemId = groupName.slice(5);
                startLongPressTimer(itemId, point.x, point.y);
              }
            }
          }
        }
      }
    }
  }

  function handlePointerMove(e: PointerEvent) {
    if (e.pointerType === 'mouse') return;

    const stage = stageRef?.node;
    if (!stage) return;

    // Update pointer position
    const currentPointer = pointers.get(e.pointerId);
    if (!currentPointer) return;

    const rect = containerEl.getBoundingClientRect();
    pointers.set(e.pointerId, clientToContainer(e.clientX, e.clientY, rect));

    // Handle pinch zoom with 2 fingers
    if (pointers.size === 2 && isPinching) {
      e.preventDefault();
      markInteractionActive();

      const [p1, p2] = Array.from(pointers.values());
      const distance = Math.sqrt(
        Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
      );
      const center = {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2
      };

      if (lastPinchDistance > 0 && lastPinchCenter) {
        // Calculate zoom change
        const scale = distance / lastPinchDistance;
        const oldZoom = zoom;
        const newZoom = clampZoom(zoom * scale, MIN_ZOOM, MAX_ZOOM);
        const result = zoomTowardPoint({
          anchorX: lastPinchCenter.x,
          anchorY: lastPinchCenter.y,
          oldZoom,
          newZoom,
          panX,
          panY,
        });
        zoom = result.zoom;
        panX = result.panX;
        panY = result.panY;
      }

      lastPinchDistance = distance;
      lastPinchCenter = center;
    } else if (pointers.size === 1 && !isPinching) {
      // Check if long-press should be cancelled (finger moved too far before triggering)
      if (longPressStartPoint && !isLongPressDragging) {
        const currentPoint = Array.from(pointers.values())[0];
        const dx = currentPoint.x - longPressStartPoint.x;
        const dy = currentPoint.y - longPressStartPoint.y;
        if (Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_MOVE_THRESHOLD) {
          cancelLongPress();
        }
      }

      if (isLongPressDragging && longPressItemId) {
        markInteractionActive();
        // Move item with finger
        const point = Array.from(pointers.values())[0];
        const canvasX = (point.x - panX) / zoom;
        const canvasY = (point.y - panY) / zoom;
        // Center item on finger
        const itemDimensions = itemDimensionsPxById.get(longPressItemId);
        if (itemDimensions) {
          const itemW = itemDimensions.widthPx;
          const itemH = itemDimensions.heightPx;
          const displayX = snapValue(canvasX - itemW / 2);
          const displayY = snapValue(canvasY - itemH / 2);
          // Update drag position for distance indicators
          dragPosition = { x: displayX, y: displayY };
        }
      } else if (!mobileMode || !longPressStartPoint) {
        // Pan (only when not in long-press detection on mobile)
        const isDraggingItem = draggingItemId !== null;
        if (!isDraggingItem) {
          markInteractionActive();
          const currentPoint = Array.from(pointers.values())[0];
          if (lastPanPoint) {
            const dx = currentPoint.x - lastPanPoint.x;
            const dy = currentPoint.y - lastPanPoint.y;
            panX += dx;
            panY += dy;
          }
          lastPanPoint = currentPoint;
        }
      }
    }
  }

  function handlePointerUp(e: PointerEvent) {
    if (e.pointerType === 'mouse') return;

    pointers.delete(e.pointerId);

    // End long-press drag
    if (isLongPressDragging) {
      endLongPressDrag();
    }
    cancelLongPress();

    // Reset pinch state if we no longer have 2 fingers
    if (pointers.size < 2) {
      isPinching = false;
      lastPinchDistance = 0;
      lastPinchCenter = null;
    }

    // Reset pan state if no fingers
    if (pointers.size === 0) {
      lastPanPoint = null;
    }
  }

  function startLongPressTimer(itemId: string, x: number, y: number) {
    cancelLongPress();
    longPressStartPoint = { x, y };
    longPressTimer = setTimeout(() => {
      longPressItemId = itemId;
      isLongPressDragging = true;
      draggingItemId = itemId; // Enable distance indicators during drag
      // Haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(50);
    }, LONG_PRESS_DURATION);
  }

  function cancelLongPress() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    longPressStartPoint = null;
  }

  function endLongPressDrag() {
    if (longPressItemId && dragPosition) {
      const natural = displayToNatural(dragPosition.x, dragPosition.y);
      onItemMove(longPressItemId, natural.x, natural.y);
    }
    isLongPressDragging = false;
    longPressItemId = null;
    draggingItemId = null;
    dragPosition = null;
    alignmentGuides = [];
    cancelLongPress();
  }

  // Pan functions
  function handleMouseDown(e: { evt: MouseEvent; target: Konva.Node }) {
    // Only pan if clicking on stage background or image (not on furniture items)
    const className = e.target.getClassName();
    // Check if it's a grid line or background, not furniture
    // Furniture items are Rect (with width > 1) or Line shapes
    const isGridOrBg = className === 'Stage' || className === 'Image' ||
      (className === 'Rect' && (e.target.width() === 1 || e.target.height() === 1));

    if (isGridOrBg) {
      isPanning = true;
      lastPanPoint = { x: e.evt.clientX, y: e.evt.clientY };
      // Change cursor to grabbing
      if (containerEl) containerEl.style.cursor = 'grabbing';
    }
  }

  function handleMouseMove(e: { evt: MouseEvent }) {
    if (!isPanning || !lastPanPoint) return;

    const dx = e.evt.clientX - lastPanPoint.x;
    const dy = e.evt.clientY - lastPanPoint.y;

    pendingPanDeltaX += dx;
    pendingPanDeltaY += dy;
    lastPanPoint = { x: e.evt.clientX, y: e.evt.clientY };
    markInteractionActive();
    scheduleInteractionFrame();
  }

  function handleMouseUp() {
    isPanning = false;
    lastPanPoint = null;
    if (containerEl) containerEl.style.cursor = 'default';
  }

  function markInteractionActive() {
    isInteractionActive = true;
    if (interactionIdleTimeout) {
      clearTimeout(interactionIdleTimeout);
    }
    interactionIdleTimeout = setTimeout(() => {
      isInteractionActive = false;
      interactionIdleTimeout = null;
    }, INTERACTION_IDLE_MS);
  }

  function scheduleInteractionFrame() {
    if (interactionFrameId !== null) return;

    interactionFrameId = requestAnimationFrame(() => {
      interactionFrameId = null;
      const next = applyCoalescedPanAndZoom({
        zoom,
        panX,
        panY,
        panDeltaX: pendingPanDeltaX,
        panDeltaY: pendingPanDeltaY,
        wheelSteps: pendingWheelSteps,
        wheelAnchorX: pendingWheelAnchorX,
        wheelAnchorY: pendingWheelAnchorY,
        zoomStep: ZOOM_STEP,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
      });

      zoom = next.zoom;
      panX = next.panX;
      panY = next.panY;

      pendingPanDeltaX = 0;
      pendingPanDeltaY = 0;
      pendingWheelSteps = 0;
      pendingWheelAnchorX = null;
      pendingWheelAnchorY = null;
    });
  }

  // Calculate the display scale (ratio of display size to natural image size)
  const displayScale = $derived.by(() => {
    if (!imageNaturalWidth || !imageDimensions.width) return 1;
    return imageDimensions.width / imageNaturalWidth;
  });

  // Convert display coordinates to natural image coordinates for storage
  // This makes positions screen-size independent
  function displayToNatural(displayX: number, displayY: number): { x: number; y: number } {
    return {
      x: (displayX - imageDimensions.x) / displayScale,
      y: (displayY - imageDimensions.y) / displayScale
    };
  }

  export function getViewportCenterNatural(): { x: number; y: number } {
    const worldCenter = getViewportCenterWorld(stageWidth, stageHeight, zoom, panX, panY);
    const natural = displayToNatural(worldCenter.x, worldCenter.y);
    return {
      x: Math.round(natural.x),
      y: Math.round(natural.y),
    };
  }

  // Convert natural image coordinates to display coordinates for rendering
  function naturalToDisplay(naturalX: number, naturalY: number): { x: number; y: number } {
    return {
      x: naturalX * displayScale + imageDimensions.x,
      y: naturalY * displayScale + imageDimensions.y
    };
  }

  // Get the effective scale for overlap detection (in display pixels per cm)
  const effectiveScale = $derived.by(() => {
    if (!floorplan?.scale) return 2;
    return floorplan.scale * displayScale;
  });
  const gridVisible = $derived(shouldRenderGrid(showGrid, isInteractionActive));
  const itemShadowStyle = $derived(getItemShadowStyle(isInteractionActive));
  const itemLayerListening = $derived.by(() =>
    shouldEnableItemLayerListening({
      isInteractionActive,
      isDraggingItem: draggingItemId !== null,
      isLongPressDragging,
    })
  );

  function drawGridScene(context: Context, shape: KonvaShape) {
    const step = Math.max(1, gridSize);
    const verticalCount = getGridStepCount(stageWidth, step);
    const horizontalCount = getGridStepCount(stageHeight, step);

    context.beginPath();
    for (let i = 0; i < verticalCount; i++) {
      const x = i * step + 0.5;
      context.moveTo(x, 0);
      context.lineTo(x, stageHeight);
    }
    for (let i = 0; i < horizontalCount; i++) {
      const y = i * step + 0.5;
      context.moveTo(0, y);
      context.lineTo(stageWidth, y);
    }
    context.strokeShape(shape);
  }

  const placedItems = $derived(items.filter(i => i.position !== null));
  const itemsById = $derived.by(() => buildIdMap(items));
  const itemDimensionsPxById = $derived.by(() => buildDimensionMap(items, effectiveScale));

  // Overlap detection
  const overlappingIds = $derived.by(() => {
    return getOverlappingItems(items, effectiveScale);
  });

  // Distance indicators - show distances to 2 nearest items within 4m
  const distanceIndicators = $derived.by(() => {
    if (!shouldShowDistanceIndicators({
      isInteractionActive,
      isDraggingItem: draggingItemId !== null
    })) {
      return [];
    }

    // Get the active item (selected or being dragged)
    const activeItemId = draggingItemId ?? selectedItemId;
    if (!activeItemId || !floorplan?.scale) return [];

    const activeItem = itemsById.get(activeItemId);
    if (!activeItem?.position) return [];

    // Convert active item to display coordinates
    // Use live drag position if dragging, otherwise use stored position
    const activeDisplayPos = draggingItemId && dragPosition
      ? dragPosition
      : naturalToDisplay(activeItem.position.x, activeItem.position.y);
    const activeDimensions = itemDimensionsPxById.get(activeItem.id);
    if (!activeDimensions) return [];
    const activeWidthPx = activeDimensions.widthPx;
    const activeHeightPx = activeDimensions.heightPx;
    const activeBox = getRotatedBoundingBox(
      activeDisplayPos.x,
      activeDisplayPos.y,
      activeWidthPx,
      activeHeightPx,
      activeItem.rotation
    );

    const candidates: Array<{
      item: Item;
      distance: number;
      distanceCm: number;
      pointA: { x: number; y: number };
      pointB: { x: number; y: number };
    }> = [];

    for (const item of placedItems) {
      if (item.id === activeItemId) continue;
      const dimensions = itemDimensionsPxById.get(item.id);
      if (!dimensions) continue;

      const itemDisplayPos = naturalToDisplay(item.position!.x, item.position!.y);
      const itemWidthPx = dimensions.widthPx;
      const itemHeightPx = dimensions.heightPx;
      const itemBox = getRotatedBoundingBox(
        itemDisplayPos.x,
        itemDisplayPos.y,
        itemWidthPx,
        itemHeightPx,
        item.rotation
      );

      const { distance, pointA, pointB } = getMinEdgeDistance(activeBox, itemBox);
      const distanceCm = distance / effectiveScale;
      if (distanceCm > MAX_DISTANCE_CM) continue;

      candidates.push({
        item,
        distance,
        distanceCm,
        pointA,
        pointB,
      });
    }

    return selectNearestByDistance(candidates, MAX_NEIGHBORS);
  });

  // Thumbnail generation - debounced after changes
  let thumbnailTimeout: ReturnType<typeof setTimeout> | null = null;
  let interactionIdleTimeout: ReturnType<typeof setTimeout> | null = null;

  function generateThumbnail() {
    const stage = stageRef?.node;
    if (!stage || !onThumbnailReady) return;

    // Reset view temporarily for consistent thumbnail
    const originalScale = { x: stage.scaleX(), y: stage.scaleY() };
    const originalPos = { x: stage.x(), y: stage.y() };

    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });

    const dataUrl = stage.toDataURL({ pixelRatio: 0.5 });

    // Restore view
    stage.scale(originalScale);
    stage.position(originalPos);

    onThumbnailReady(dataUrl);
  }

  function debounceThumbnail() {
    if (!onThumbnailReady) return;
    if (thumbnailTimeout) clearTimeout(thumbnailTimeout);
    thumbnailTimeout = setTimeout(generateThumbnail, 2000);
  }

  // Generate thumbnail when items or floorplan changes
  $effect(() => {
    // Track dependencies
    const _ = [items.length, floorplanImage];
    debounceThumbnail();
  });
</script>

<div
  bind:this={containerEl}
  class="w-full h-full bg-canvas-bg relative"
  onwheel={handleWheel}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
  style="touch-action: none;"
>
  <Stage
    bind:this={stageRef}
    width={stageWidth}
    height={stageHeight}
    scaleX={zoom}
    scaleY={zoom}
    x={panX}
    y={panY}
    onpointerclick={handleStageClick}
    onmousedown={handleMouseDown}
    onmousemove={handleMouseMove}
    onmouseup={handleMouseUp}
    onmouseleave={handleMouseUp}
  >
    <Layer listening={false}>
      <!-- Grid -->
      {#if gridVisible}
        <Shape
          listening={false}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1}
          sceneFunc={drawGridScene}
        />
      {/if}

      <!-- Floorplan image -->
      {#if floorplanImage}
        <KonvaImage
          image={floorplanImage}
          x={imageDimensions.x}
          y={imageDimensions.y}
          width={imageDimensions.width}
          height={imageDimensions.height}
          opacity={0.8}
        />
      {/if}
    </Layer>

    <Layer listening={itemLayerListening}>
      <!-- Furniture items -->
      {#each placedItems as item (item.id)}
        {@const isOverlapping = overlappingIds.has(item.id)}
        {@const itemDimensions = itemDimensionsPxById.get(item.id)}
        {@const itemWidthPx = itemDimensions?.widthPx ?? item.width * effectiveScale}
        {@const itemHeightPx = itemDimensions?.heightPx ?? item.height * effectiveScale}
        {@const displayPos = resolveItemDisplayPosition({
          itemId: item.id,
          naturalX: item.position!.x,
          naturalY: item.position!.y,
          draggingItemId,
          dragPosition,
          naturalToDisplay
        })}
        {@const renderLabels = shouldRenderItemLabels({
          isInteractionActive,
          isSelected: selectedItemId === item.id,
          isDragging: draggingItemId === item.id || longPressItemId === item.id
        })}
        <Group
          x={displayPos.x}
          y={displayPos.y}
          rotation={item.rotation}
          draggable={!mobileMode}
          config={{ name: `item-${item.id}` }}
          onpointerclick={() => onItemSelect(item.id)}
          oncontextmenu={mobileMode ? undefined : (e) => handleItemContextMenu(item.id, e)}
          ondragstart={mobileMode ? undefined : () => handleDragStart(item.id)}
          ondragmove={mobileMode ? undefined : (e) => handleDragMove(item.id, e)}
          ondragend={mobileMode ? undefined : (e) => handleDragEnd(item.id, e)}
        >
          {#if item.shape === 'l-shape'}
            <Line
              points={getItemShapePoints(item, effectiveScale)}
              closed={true}
              fill={isOverlapping ? '#F87171' : item.color}
              opacity={isOverlapping ? 0.7 : 1}
              shadowColor="black"
              shadowBlur={itemShadowStyle.blur}
              shadowOpacity={itemShadowStyle.opacity}
              shadowOffsetX={itemShadowStyle.offsetX}
              shadowOffsetY={itemShadowStyle.offsetY}
              stroke={longPressItemId === item.id ? '#3B82F6' : (selectedItemId === item.id ? '#60A5FA' : (isOverlapping ? '#DC2626' : 'transparent'))}
              strokeWidth={longPressItemId === item.id ? 3 : 2}
            />
          {:else}
            <Rect
              width={itemWidthPx}
              height={itemHeightPx}
              fill={isOverlapping ? '#F87171' : item.color}
              opacity={isOverlapping ? 0.7 : 1}
              shadowColor="black"
              shadowBlur={itemShadowStyle.blur}
              shadowOpacity={itemShadowStyle.opacity}
              shadowOffsetX={itemShadowStyle.offsetX}
              shadowOffsetY={itemShadowStyle.offsetY}
              stroke={longPressItemId === item.id ? '#3B82F6' : (selectedItemId === item.id ? '#60A5FA' : (isOverlapping ? '#DC2626' : 'transparent'))}
              strokeWidth={longPressItemId === item.id ? 3 : 2}
              cornerRadius={2}
            />
          {/if}
          {#if renderLabels}
            <!-- Item label -->
            <Text
              x={0}
              y={itemHeightPx / 2 - 12}
              text={item.name}
              fontSize={itemNameFontSize}
              fontFamily="system-ui, sans-serif"
              fontStyle="bold"
              fill="#1e293b"
              align="center"
              width={itemWidthPx}
              listening={false}
            />
            <Text
              x={0}
              y={itemHeightPx / 2 + 2}
              text={`${item.width} × ${item.height} cm`}
              fontSize={itemDimensionsFontSize}
              fontFamily="system-ui, sans-serif"
              fill="#475569"
              align="center"
              width={itemWidthPx}
              listening={false}
            />
          {/if}
        </Group>
      {/each}
    </Layer>

    <!-- Distance indicators -->
    {#if distanceIndicators.length > 0}
      <Layer listening={false}>
        {#each distanceIndicators as indicator}
          {@const dx = indicator.pointB.x - indicator.pointA.x}
          {@const dy = indicator.pointB.y - indicator.pointA.y}
          {@const angle = Math.atan2(dy, dx)}
          {@const midX = (indicator.pointA.x + indicator.pointB.x) / 2}
          {@const midY = (indicator.pointA.y + indicator.pointB.y) / 2}
          {@const labelText = `${Math.round(indicator.distanceCm)} cm`}
          {@const endCapLength = END_CAP_LENGTH / zoom}

          <!-- Main dimension line -->
          <Line
            points={[indicator.pointA.x, indicator.pointA.y, indicator.pointB.x, indicator.pointB.y]}
            stroke="#3B82F6"
            strokeWidth={1.5 / zoom}
            listening={false}
          />

          <!-- End cap at pointA -->
          <Line
            points={[
              indicator.pointA.x - Math.sin(angle) * endCapLength,
              indicator.pointA.y + Math.cos(angle) * endCapLength,
              indicator.pointA.x + Math.sin(angle) * endCapLength,
              indicator.pointA.y - Math.cos(angle) * endCapLength,
            ]}
            stroke="#3B82F6"
            strokeWidth={1.5 / zoom}
            listening={false}
          />

          <!-- End cap at pointB -->
          <Line
            points={[
              indicator.pointB.x - Math.sin(angle) * endCapLength,
              indicator.pointB.y + Math.cos(angle) * endCapLength,
              indicator.pointB.x + Math.sin(angle) * endCapLength,
              indicator.pointB.y - Math.cos(angle) * endCapLength,
            ]}
            stroke="#3B82F6"
            strokeWidth={1.5 / zoom}
            listening={false}
          />

          <!-- Distance label with background -->
          <Group x={midX} y={midY} listening={false}>
            {@const labelWidth = Math.max(50, labelText.length * 7) / zoom}
            {@const labelHeight = 20 / zoom}
            {@const labelYOffset = 10 / zoom}
            <Rect
              x={-labelWidth / 2}
              y={-labelYOffset}
              width={labelWidth}
              height={labelHeight}
              fill="white"
              cornerRadius={4 / zoom}
              shadowColor="black"
              shadowBlur={2 / zoom}
              shadowOpacity={0.2}
            />
            <Text
              x={-labelWidth / 2}
              y={-labelYOffset}
              width={labelWidth}
              height={labelHeight}
              text={labelText}
              fontSize={distanceLabelFontSize}
              fontFamily="system-ui, sans-serif"
              fontStyle="bold"
              fill="#3B82F6"
              align="center"
              verticalAlign="middle"
            />
          </Group>
        {/each}
      </Layer>
    {/if}

    <!-- Alignment guides -->
    {#if alignmentGuides.length > 0}
      <Layer listening={false}>
        {#each alignmentGuides as guide}
          {#if guide.type === 'v'}
            <Line
              points={[guide.pos, -10000, guide.pos, 10000]}
              stroke="#3B82F6"
              strokeWidth={1 / zoom}
              dash={[4 / zoom, 4 / zoom]}
              listening={false}
            />
          {:else}
            <Line
              points={[-10000, guide.pos, 10000, guide.pos]}
              stroke="#3B82F6"
              strokeWidth={1 / zoom}
              dash={[4 / zoom, 4 / zoom]}
              listening={false}
            />
          {/if}
        {/each}
      </Layer>
    {/if}
  </Stage>

  <!-- Zoom controls -->
  <div class="absolute top-2 right-2 flex flex-col gap-1 bg-white rounded shadow-lg p-1">
    <Button
      variant="ghost"
      size="icon-sm"
      class="text-slate-600"
      onclick={zoomIn}
      title="Zoom in"
      disabled={zoomLocked}
    >
      <Plus size={16} />
    </Button>
    <div class="text-xs text-center text-slate-500 py-1">
      {Math.round(zoom * 100)}%
    </div>
    <Button
      variant="ghost"
      size="icon-sm"
      class="text-slate-600"
      onclick={zoomOut}
      title="Zoom out"
      disabled={zoomLocked}
    >
      <Minus size={16} />
    </Button>
    <Button
      variant="ghost"
      size="icon-sm"
      class="text-slate-600"
      onclick={resetView}
      title="Reset view"
    >
      <RefreshCw size={14} />
    </Button>
    <Button
      variant="ghost"
      size="icon-sm"
      class={zoomLocked ? 'text-blue-600 bg-blue-50' : 'text-slate-600'}
      onclick={() => zoomLocked = !zoomLocked}
      title={zoomLocked ? 'Unlock zoom' : 'Lock zoom'}
    >
      {#if zoomLocked}
        <Lock size={14} />
      {:else}
        <Unlock size={14} />
      {/if}
    </Button>
  </div>

  <!-- Scale bar -->
  {#if floorplan?.scale}
    {@const scaleBarWidth = 100 * effectiveScale * zoom}
    <div class="absolute bottom-2 right-2 flex flex-col items-end gap-0.5 bg-white/90 rounded shadow-lg px-2 py-1">
      <div
        class="h-1.5 bg-slate-700 rounded-sm"
        style="width: {Math.max(20, Math.min(200, scaleBarWidth))}px;"
      ></div>
      <span class="text-xs text-slate-600 font-mono">100 cm</span>
    </div>
  {/if}

  <!-- Item context menu -->
  {#if contextMenuOpen}
    <!-- Backdrop to close menu on click outside -->
    <button
      type="button"
      class="fixed inset-0 z-40"
      onclick={() => contextMenuOpen = false}
      oncontextmenu={(e) => { e.preventDefault(); contextMenuOpen = false; }}
      aria-label="Close menu"
    ></button>
    <div
      class="fixed z-50 min-w-[160px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
      style="left: {contextMenuPosition.x}px; top: {contextMenuPosition.y}px;"
      role="menu"
    >
      <button
        type="button"
        class="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
        onclick={() => handleContextMenuAction('rotate-ccw')}
        role="menuitem"
      >
        <RotateCcw class="mr-2 size-4" />
        Rotate Left
      </button>
      <button
        type="button"
        class="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
        onclick={() => handleContextMenuAction('rotate-cw')}
        role="menuitem"
      >
        <RotateCw class="mr-2 size-4" />
        Rotate Right
      </button>
      <div class="-mx-1 my-1 h-px bg-muted"></div>
      <button
        type="button"
        class="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none text-red-600 hover:bg-red-50 hover:text-red-600"
        onclick={() => handleContextMenuAction('unplace')}
        role="menuitem"
      >
        <MapPinOff class="mr-2 size-4" />
        Remove from Plan
      </button>
    </div>
  {/if}
</div>
