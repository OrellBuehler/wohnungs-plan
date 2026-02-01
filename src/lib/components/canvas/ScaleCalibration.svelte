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
  let stageWidth = $state(800);
  let stageHeight = $state(600);
  let image: HTMLImageElement | null = $state(null);

  let point1 = $state<{ x: number; y: number } | null>(null);
  let point2 = $state<{ x: number; y: number } | null>(null);
  let referenceLength = $state(100); // Default 100cm

  // Load image
  $effect(() => {
    const img = new Image();
    img.onload = () => {
      image = img;
    };
    img.src = imageData;
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

  const scale = $derived.by(() => {
    if (lineLength === 0 || referenceLength <= 0) return 0;
    return lineLength / referenceLength; // pixels per cm
  });

  function handleStageClick(e: { target: Konva.Node; evt: MouseEvent }) {
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    if (!point1) {
      point1 = { x: pos.x, y: pos.y };
    } else if (!point2) {
      point2 = { x: pos.x, y: pos.y };
    } else {
      // Reset and start over
      point1 = { x: pos.x, y: pos.y };
      point2 = null;
    }
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
      Click two points on your floorplan to draw a reference line, then enter its real-world length.
    </p>
  </div>

  <div bind:this={containerEl} class="flex-1 bg-slate-900">
    <Stage width={stageWidth} height={stageHeight} onpointerclick={handleStageClick}>
      <Layer>
        {#if image}
          <KonvaImage
            image={image}
            x={0}
            y={0}
            width={stageWidth}
            height={stageHeight}
          />
        {/if}

        {#if point1}
          <Circle x={point1.x} y={point1.y} radius={8} fill="#60A5FA" stroke="#fff" strokeWidth={2} />
        {/if}

        {#if point2}
          <Circle x={point2.x} y={point2.y} radius={8} fill="#60A5FA" stroke="#fff" strokeWidth={2} />
        {/if}

        {#if point1 && point2}
          <Line
            points={[point1.x, point1.y, point2.x, point2.y]}
            stroke="#60A5FA"
            strokeWidth={3}
            dash={[10, 5]}
          />
          <Text
            x={(point1.x + point2.x) / 2}
            y={(point1.y + point2.y) / 2 - 20}
            text={`${lineLength.toFixed(0)}px`}
            fill="#fff"
            fontSize={14}
            fontFamily="JetBrains Mono"
          />
        {/if}
      </Layer>
    </Stage>
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
