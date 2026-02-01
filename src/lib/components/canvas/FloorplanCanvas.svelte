<script lang="ts">
  import { Stage, Layer, Image as KonvaImage, Rect } from 'svelte-konva';
  import type { Item, Floorplan } from '$lib/types';
  import type Konva from 'konva';
  import { getOverlappingItems } from '$lib/utils/geometry';

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
  let stageWidth = $state(800);
  let stageHeight = $state(600);
  let floorplanImage: HTMLImageElement | null = $state(null);

  // Load floorplan image
  $effect(() => {
    if (floorplan?.imageData) {
      const img = new Image();
      img.onload = () => {
        floorplanImage = img;
      };
      img.src = floorplan.imageData;
    } else {
      floorplanImage = null;
    }
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
    // Check if clicked on stage background
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

  // Convert cm to pixels using scale
  function cmToPixels(cm: number): number {
    if (!floorplan?.scale) return cm * 2; // Default fallback
    return cm * floorplan.scale;
  }

  // Grid lines for rendering
  const verticalLines = $derived(Array.from({ length: Math.ceil(stageWidth / gridSize) + 1 }, (_, i) => i * gridSize));
  const horizontalLines = $derived(Array.from({ length: Math.ceil(stageHeight / gridSize) + 1 }, (_, i) => i * gridSize));
  const placedItems = $derived(items.filter(i => i.position !== null));

  // Overlap detection
  const overlappingIds = $derived.by(() => {
    const scale = floorplan?.scale ?? 2;
    return getOverlappingItems(items, scale);
  });
</script>

<div bind:this={containerEl} class="w-full h-full bg-canvas-bg relative">
  <Stage width={stageWidth} height={stageHeight} onpointerclick={handleStageClick}>
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
          x={0}
          y={0}
          width={stageWidth}
          height={stageHeight}
          opacity={0.8}
        />
      {/if}
    </Layer>

    <Layer>
      <!-- Furniture items -->
      {#each placedItems as item (item.id)}
        {@const isOverlapping = overlappingIds.has(item.id)}
        <Rect
          x={item.position!.x}
          y={item.position!.y}
          width={cmToPixels(item.width)}
          height={cmToPixels(item.height)}
          fill={isOverlapping ? '#F87171' : item.color}
          opacity={isOverlapping ? 0.7 : 1}
          rotation={item.rotation}
          draggable
          shadowColor="black"
          shadowBlur={10}
          shadowOpacity={0.3}
          shadowOffsetX={4}
          shadowOffsetY={4}
          stroke={selectedItemId === item.id ? '#60A5FA' : (isOverlapping ? '#DC2626' : 'transparent')}
          strokeWidth={2}
          cornerRadius={2}
          onpointerclick={() => onItemSelect(item.id)}
          ondragend={(e) => handleDragEnd(item.id, e)}
        />
      {/each}
    </Layer>
  </Stage>

  <!-- Rotation controls for selected item -->
  {#if selectedItemId}
    {@const selectedItem = items.find(i => i.id === selectedItemId)}
    {#if selectedItem?.position}
      <div
        class="absolute flex gap-1 bg-white rounded shadow-lg p-1"
        style="left: {selectedItem.position.x}px; top: {selectedItem.position.y - 40}px;"
      >
        <button
          class="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded text-slate-600"
          onclick={() => handleRotate(selectedItemId, 'ccw')}
          title="Rotate left"
        >
          ↶
        </button>
        <button
          class="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded text-slate-600"
          onclick={() => handleRotate(selectedItemId, 'cw')}
          title="Rotate right"
        >
          ↷
        </button>
      </div>
    {/if}
  {/if}
</div>
