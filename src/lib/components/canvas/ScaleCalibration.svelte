<script lang="ts">
  import { Stage, Layer, Image as KonvaImage, Line, Circle, Text } from 'svelte-konva';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import type Konva from 'konva';

  interface Props {
    imageData: string;
    onCalibrate: (scale: number, referenceLength: number) => void;
    onCancel: () => void;
  }

  let { imageData, onCalibrate, onCancel }: Props = $props();

  let containerEl: HTMLDivElement;
  let stageRef: { node: Konva.Stage } | undefined = $state();
  let stageWidth = $state(800);
  let stageHeight = $state(600);
  let image: HTMLImageElement | null = $state(null);
  let imageNaturalWidth = $state(0);
  let imageNaturalHeight = $state(0);

  let point1 = $state<{ x: number; y: number } | null>(null);
  let point2 = $state<{ x: number; y: number } | null>(null);
  let referenceLength = $state(100);

  // Zoom and pan state
  let zoom = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let isPanning = $state(false);
  let lastPanPoint = $state<{ x: number; y: number } | null>(null);
  let mouseDownPoint = $state<{ x: number; y: number } | null>(null);
  let hasDragged = $state(false);

  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 8;
  const ZOOM_STEP = 0.1;
  const DRAG_THRESHOLD = 5; // pixels

  // Load image
  $effect(() => {
    const img = new Image();
    img.onload = () => {
      imageNaturalWidth = img.naturalWidth;
      imageNaturalHeight = img.naturalHeight;
      image = img;
    };
    img.src = imageData;
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

  const lineLength = $derived.by(() => {
    if (!point1 || !point2) return 0;
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
    );
  });

  // Calculate the ratio between displayed image and natural image
  const displayToNaturalRatio = $derived.by(() => {
    if (!imageDimensions.width || !imageNaturalWidth) return 1;
    return imageNaturalWidth / imageDimensions.width;
  });

  // Scale in natural image pixels per cm (not display pixels)
  const scale = $derived.by(() => {
    if (lineLength === 0 || referenceLength <= 0) return 0;
    // Convert line length from display pixels to natural image pixels
    const naturalLineLength = lineLength * displayToNaturalRatio;
    return naturalLineLength / referenceLength;
  });

  // Convert screen coordinates to canvas coordinates
  function screenToCanvas(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - panX) / zoom,
      y: (screenY - panY) / zoom,
    };
  }

  function placePoint() {
    const stage = stageRef?.node;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const canvasPos = screenToCanvas(pointer.x, pointer.y);

    if (!point1) {
      point1 = canvasPos;
    } else if (!point2) {
      point2 = canvasPos;
    } else {
      point1 = canvasPos;
      point2 = null;
    }
  }

  // Zoom functions
  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const stage = stageRef?.node;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const oldZoom = zoom;
    const newZoom = e.deltaY < 0
      ? Math.min(MAX_ZOOM, zoom + ZOOM_STEP)
      : Math.max(MIN_ZOOM, zoom - ZOOM_STEP);

    const mousePointTo = {
      x: (pointer.x - panX) / oldZoom,
      y: (pointer.y - panY) / oldZoom,
    };

    zoom = newZoom;
    panX = pointer.x - mousePointTo.x * newZoom;
    panY = pointer.y - mousePointTo.y * newZoom;
  }

  function zoomIn() {
    const newZoom = Math.min(MAX_ZOOM, zoom + ZOOM_STEP * 2);
    const centerX = stageWidth / 2;
    const centerY = stageHeight / 2;
    const mousePointTo = {
      x: (centerX - panX) / zoom,
      y: (centerY - panY) / zoom,
    };
    zoom = newZoom;
    panX = centerX - mousePointTo.x * newZoom;
    panY = centerY - mousePointTo.y * newZoom;
  }

  function zoomOut() {
    const newZoom = Math.max(MIN_ZOOM, zoom - ZOOM_STEP * 2);
    const centerX = stageWidth / 2;
    const centerY = stageHeight / 2;
    const mousePointTo = {
      x: (centerX - panX) / zoom,
      y: (centerY - panY) / zoom,
    };
    zoom = newZoom;
    panX = centerX - mousePointTo.x * newZoom;
    panY = centerY - mousePointTo.y * newZoom;
  }

  function resetView() {
    zoom = 1;
    panX = 0;
    panY = 0;
  }

  // Pan functions - drag to pan, click (without drag) to place point
  function handleMouseDown(e: { evt: MouseEvent; target: Konva.Node }) {
    if (e.evt.button === 0) { // Left click
      isPanning = true;
      hasDragged = false;
      mouseDownPoint = { x: e.evt.clientX, y: e.evt.clientY };
      lastPanPoint = { x: e.evt.clientX, y: e.evt.clientY };
    }
  }

  function handleMouseMove(e: { evt: MouseEvent }) {
    if (!isPanning || !lastPanPoint || !mouseDownPoint) return;

    const dx = e.evt.clientX - lastPanPoint.x;
    const dy = e.evt.clientY - lastPanPoint.y;

    // Check if we've moved past the drag threshold
    const totalDx = Math.abs(e.evt.clientX - mouseDownPoint.x);
    const totalDy = Math.abs(e.evt.clientY - mouseDownPoint.y);
    if (totalDx > DRAG_THRESHOLD || totalDy > DRAG_THRESHOLD) {
      hasDragged = true;
    }

    if (hasDragged) {
      panX += dx;
      panY += dy;
      if (containerEl) containerEl.style.cursor = 'grabbing';
    }

    lastPanPoint = { x: e.evt.clientX, y: e.evt.clientY };
  }

  function handleMouseUp() {
    // If we didn't drag, this was a click - place a point
    if (isPanning && !hasDragged) {
      placePoint();
    }

    isPanning = false;
    lastPanPoint = null;
    mouseDownPoint = null;
    hasDragged = false;
    if (containerEl) containerEl.style.cursor = 'crosshair';
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
  }

  function handleConfirm() {
    if (scale > 0) {
      onCalibrate(scale, referenceLength);
    }
  }
</script>

<div class="flex flex-col h-full">
  <div class="p-4 bg-blue-600 text-white">
    <h2 class="font-semibold mb-1">Set Scale</h2>
    <p class="text-sm text-blue-100">
      Click two points to draw a reference line, then enter its real-world length.
      <strong>Scroll to zoom, drag to pan.</strong>
    </p>
  </div>

  <div
    bind:this={containerEl}
    class="flex-1 bg-slate-900 relative cursor-crosshair"
    onwheel={handleWheel}
    oncontextmenu={handleContextMenu}
    role="application"
  >
    <Stage
      bind:this={stageRef}
      width={stageWidth}
      height={stageHeight}
      scaleX={zoom}
      scaleY={zoom}
      x={panX}
      y={panY}
      onmousedown={handleMouseDown}
      onmousemove={handleMouseMove}
      onmouseup={handleMouseUp}
      onmouseleave={handleMouseUp}
    >
      <Layer>
        {#if image}
          <KonvaImage
            image={image}
            x={imageDimensions.x}
            y={imageDimensions.y}
            width={imageDimensions.width}
            height={imageDimensions.height}
          />
        {/if}

        {#if point1}
          <Circle x={point1.x} y={point1.y} radius={8 / zoom} fill="#60A5FA" stroke="#fff" strokeWidth={2 / zoom} />
        {/if}

        {#if point2}
          <Circle x={point2.x} y={point2.y} radius={8 / zoom} fill="#60A5FA" stroke="#fff" strokeWidth={2 / zoom} />
        {/if}

        {#if point1 && point2}
          <Line
            points={[point1.x, point1.y, point2.x, point2.y]}
            stroke="#60A5FA"
            strokeWidth={3 / zoom}
            dash={[10 / zoom, 5 / zoom]}
          />
          <Text
            x={(point1.x + point2.x) / 2 + 10 / zoom}
            y={(point1.y + point2.y) / 2 - 20 / zoom}
            text={`${lineLength.toFixed(0)}px`}
            fill="#fff"
            fontSize={14 / zoom}
            fontFamily="JetBrains Mono"
          />
        {/if}
      </Layer>
    </Stage>

    <!-- Zoom controls -->
    <div class="absolute top-2 right-2 flex flex-col gap-1 bg-white rounded shadow-lg p-1">
      <Button
        variant="ghost"
        size="icon-sm"
        class="text-slate-600 font-bold"
        onclick={zoomIn}
        title="Zoom in"
      >
        +
      </Button>
      <div class="text-xs text-center text-slate-500 py-1">
        {Math.round(zoom * 100)}%
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        class="text-slate-600 font-bold"
        onclick={zoomOut}
        title="Zoom out"
      >
        −
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        class="text-slate-600 text-xs"
        onclick={resetView}
        title="Reset view"
      >
        ⟲
      </Button>
    </div>
  </div>

  <div class="p-4 bg-white border-t border-slate-200">
    <div class="flex items-end gap-4">
      <div class="flex-1">
        <Label for="length">Reference Length (cm)</Label>
        <Input
          id="length"
          type="number"
          bind:value={referenceLength}
          min={1}
          class="font-mono"
        />
      </div>
      <div class="text-sm text-slate-600 pb-2">
        {#if scale > 0}
          Scale: {scale.toFixed(2)} px/cm
        {:else}
          Draw a reference line
        {/if}
      </div>
      <Button variant="outline" onclick={onCancel}>Cancel</Button>
      <Button onclick={handleConfirm} disabled={scale === 0}>Confirm Scale</Button>
    </div>
  </div>
</div>
