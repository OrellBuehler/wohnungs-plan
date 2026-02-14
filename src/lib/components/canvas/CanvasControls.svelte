<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Separator } from '$lib/components/ui/separator';
  import {
    getFloorplanAnalysis,
    toggleWallsDoors,
    hasFloorplanAnalysis
  } from '$lib/stores/project.svelte';
  import {
    isCommentsVisible,
    toggleCommentsVisibility,
    getComments
  } from '$lib/stores/comments.svelte';

  interface Props {
    showGrid: boolean;
    snapToGrid: boolean;
    gridSize: number;
    scale: number;
    onChangeFloorplan: () => void;
    onGridSizeChange: (size: number) => void;
    onRecalibrate: () => void;
  }

  let {
    showGrid = $bindable(),
    snapToGrid = $bindable(),
    gridSize,
    scale,
    onChangeFloorplan,
    onGridSizeChange,
    onRecalibrate,
  }: Props = $props();

  // Floorplan analysis state
  const floorplanAnalysis = $derived(getFloorplanAnalysis());
  const hasAnalysis = $derived(hasFloorplanAnalysis());
  const showWallsDoors = $derived(floorplanAnalysis.visible);

  // Comments state
  const showComments = $derived(isCommentsVisible());
  const commentCount = $derived(getComments().filter(c => !c.resolved).length);

  function handleGridSizeInput(e: Event) {
    const value = parseInt((e.target as HTMLInputElement).value, 10);
    if (!isNaN(value)) {
      onGridSizeChange(value);
    }
  }
</script>

<div class="flex-shrink-0 flex items-center gap-4 px-4 pb-4 text-sm">
  <Label class="flex items-center gap-2 text-slate-600 cursor-pointer">
    <Checkbox bind:checked={showGrid} />
    Grid
  </Label>

  <Label class="flex items-center gap-2 text-slate-600 cursor-pointer">
    <Checkbox bind:checked={snapToGrid} />
    Snap
  </Label>

  {#if hasAnalysis}
    <Label
      class="flex items-center gap-2 text-slate-600 cursor-pointer"
      title="Show/hide AI-detected walls and doors"
    >
      <Checkbox
        checked={showWallsDoors}
        onchange={() => toggleWallsDoors()}
      />
      Walls & Doors
    </Label>
  {/if}

  <Label class="flex items-center gap-2 text-slate-600 cursor-pointer">
    <Checkbox
      checked={showComments}
      onchange={() => toggleCommentsVisibility()}
    />
    Comments
  </Label>

  <Separator orientation="vertical" class="h-6" />

  <Label class="flex items-center gap-2 text-slate-600">
    Grid size:
    <Input
      type="number"
      value={gridSize}
      oninput={handleGridSizeInput}
      min={1}
      max={200}
      step={1}
      class="w-16 h-8 font-mono text-sm"
    />
    px
  </Label>

  <div class="flex-1"></div>

  {#if hasAnalysis && showWallsDoors}
    <span class="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
      {floorplanAnalysis.walls.length} walls,
      {floorplanAnalysis.doors.length} doors
    </span>
  {/if}

  {#if showComments && commentCount > 0}
    <span class="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
      {commentCount} comment{commentCount !== 1 ? 's' : ''}
    </span>
  {/if}

  <span class="text-xs text-slate-400 font-mono">
    {scale.toFixed(2)} px/cm
  </span>

  <Button
    variant="ghost"
    size="sm"
    class="text-slate-500 hover:text-slate-700"
    onclick={onRecalibrate}
  >
    Recalibrate
  </Button>

  <Button
    variant="ghost"
    size="sm"
    class="text-slate-500 hover:text-slate-700"
    onclick={onChangeFloorplan}
  >
    Change Floorplan
  </Button>
</div>
