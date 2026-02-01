<script lang="ts">
  import { Stage, Layer, Image as KonvaImage, Rect, Line, Text, Group } from 'svelte-konva';
  import type { Item, Floorplan } from '$lib/types';
  import type Konva from 'konva';
  import { getOverlappingItems, getItemShapePoints } from '$lib/utils/geometry';
  import { Button } from '$lib/components/ui/button';

  interface Props {
    floorplan: Floorplan | null;
    items: Item[];
    selectedItemId: string | null;
    gridSize: number;
    showGrid: boolean;
    snapToGrid: boolean;
    onItemSelect: (id: string | null) => void;
    onItemMove: (id: string, x: number, y: number) => void;
    onItemRotate: (id: string, rotation: number) => void;
  }

  let {
    floorplan,
    items,
    selectedItemId,
    gridSize = 50,
    showGrid = true,
    snapToGrid = true,
    onItemSelect,
    onItemMove,
    onItemRotate,
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

  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 4;
  const ZOOM_STEP = 0.1;

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
    const x = snapValue(node.x());
    const y = snapValue(node.y());
    node.x(x);
    node.y(y);
    onItemMove(itemId, x, y);
  }

  function handleRotate(itemId: string, direction: 'cw' | 'ccw') {
    const item = items.find(i => i.id === itemId);
    if (item) {
      const delta = direction === 'cw' ? 90 : -90;
      const newRotation = (item.rotation + delta + 360) % 360;
      onItemRotate(itemId, newRotation);
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

    // Zoom toward pointer position
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
    // Zoom toward center
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

    panX += dx;
    panY += dy;
    lastPanPoint = { x: e.evt.clientX, y: e.evt.clientY };
  }

  function handleMouseUp() {
    isPanning = false;
    lastPanPoint = null;
    if (containerEl) containerEl.style.cursor = 'default';
  }

  // Calculate the display scale (ratio of display size to natural image size)
  const displayScale = $derived.by(() => {
    if (!imageNaturalWidth || !imageDimensions.width) return 1;
    return imageDimensions.width / imageNaturalWidth;
  });

  // Convert cm to display pixels using stored scale (natural pixels/cm) and display scale
  function cmToPixels(cm: number): number {
    if (!floorplan?.scale) return cm * 2;
    // floorplan.scale is in natural image pixels per cm
    // multiply by displayScale to get display pixels
    return cm * floorplan.scale * displayScale;
  }

  // Get the effective scale for overlap detection (in display pixels per cm)
  const effectiveScale = $derived.by(() => {
    if (!floorplan?.scale) return 2;
    return floorplan.scale * displayScale;
  });

  // Grid lines for rendering
  const verticalLines = $derived(Array.from({ length: Math.ceil(stageWidth / gridSize) + 1 }, (_, i) => i * gridSize));
  const horizontalLines = $derived(Array.from({ length: Math.ceil(stageHeight / gridSize) + 1 }, (_, i) => i * gridSize));
  const placedItems = $derived(items.filter(i => i.position !== null));

  // Overlap detection
  const overlappingIds = $derived.by(() => {
    return getOverlappingItems(items, effectiveScale);
  });
</script>

<div
  bind:this={containerEl}
  class="w-full h-full bg-canvas-bg relative"
  onwheel={handleWheel}
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
    <Layer>
      <!-- Grid -->
      {#if showGrid}
        {#each verticalLines as x}
          <Rect
            x={x}
            y={0}
            width={1}
            height={stageHeight}
            fill="rgba(255,255,255,0.1)"
          />
        {/each}
        {#each horizontalLines as y}
          <Rect
            x={0}
            y={y}
            width={stageWidth}
            height={1}
            fill="rgba(255,255,255,0.1)"
          />
        {/each}
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

    <Layer>
      <!-- Furniture items -->
      {#each placedItems as item (item.id)}
        {@const isOverlapping = overlappingIds.has(item.id)}
        {@const itemWidthPx = cmToPixels(item.width)}
        {@const itemHeightPx = cmToPixels(item.height)}
        <Group
          x={item.position!.x}
          y={item.position!.y}
          rotation={item.rotation}
          draggable
          onpointerclick={() => onItemSelect(item.id)}
          ondragend={(e) => handleDragEnd(item.id, e)}
        >
          {#if item.shape === 'l-shape'}
            <Line
              points={getItemShapePoints(item, effectiveScale)}
              closed={true}
              fill={isOverlapping ? '#F87171' : item.color}
              opacity={isOverlapping ? 0.7 : 1}
              shadowColor="black"
              shadowBlur={10}
              shadowOpacity={0.3}
              shadowOffsetX={4}
              shadowOffsetY={4}
              stroke={selectedItemId === item.id ? '#60A5FA' : (isOverlapping ? '#DC2626' : 'transparent')}
              strokeWidth={2}
            />
          {:else}
            <Rect
              width={itemWidthPx}
              height={itemHeightPx}
              fill={isOverlapping ? '#F87171' : item.color}
              opacity={isOverlapping ? 0.7 : 1}
              shadowColor="black"
              shadowBlur={10}
              shadowOpacity={0.3}
              shadowOffsetX={4}
              shadowOffsetY={4}
              stroke={selectedItemId === item.id ? '#60A5FA' : (isOverlapping ? '#DC2626' : 'transparent')}
              strokeWidth={2}
              cornerRadius={2}
            />
          {/if}
          <!-- Item label -->
          <Text
            x={0}
            y={itemHeightPx / 2 - 12}
            text={item.name}
            fontSize={12}
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
            fontSize={10}
            fontFamily="system-ui, sans-serif"
            fill="#475569"
            align="center"
            width={itemWidthPx}
            listening={false}
          />
        </Group>
      {/each}
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

  <!-- Rotation controls for selected item -->
  {#if selectedItemId}
    {@const selectedItem = items.find(i => i.id === selectedItemId)}
    {#if selectedItem?.position}
      <div
        class="absolute flex gap-1 bg-white rounded shadow-lg p-1"
        style="left: {(selectedItem.position.x * zoom) + panX}px; top: {(selectedItem.position.y * zoom) + panY - 40}px;"
      >
        <Button
          variant="ghost"
          size="icon-sm"
          class="text-slate-600"
          onclick={() => handleRotate(selectedItemId, 'ccw')}
          title="Rotate left"
        >
          ↶
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          class="text-slate-600"
          onclick={() => handleRotate(selectedItemId, 'cw')}
          title="Rotate right"
        >
          ↷
        </Button>
      </div>
    {/if}
  {/if}

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
</div>
