<script lang="ts">
  import { Button } from '$lib/components/ui/button';

  interface Props {
    showGrid: boolean;
    snapToGrid: boolean;
    gridSize: number;
    onShowGridChange: (show: boolean) => void;
    onSnapToGridChange: (snap: boolean) => void;
    onGridSizeChange: (size: number) => void;
    onResetFloorplan: () => void;
  }

  let {
    showGrid,
    snapToGrid,
    gridSize,
    onShowGridChange,
    onSnapToGridChange,
    onGridSizeChange,
    onResetFloorplan,
  }: Props = $props();
</script>

<div class="flex items-center gap-4 px-4 py-2 bg-white border-t border-slate-200">
  <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
    <input
      type="checkbox"
      checked={showGrid}
      onchange={(e) => onShowGridChange(e.currentTarget.checked)}
      class="rounded"
    />
    Grid
  </label>

  <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
    <input
      type="checkbox"
      checked={snapToGrid}
      onchange={(e) => onSnapToGridChange(e.currentTarget.checked)}
      class="rounded"
    />
    Snap
  </label>

  <div class="h-6 w-px bg-slate-200"></div>

  <label class="flex items-center gap-2 text-sm text-slate-600">
    Grid:
    <input
      type="number"
      value={gridSize}
      min={10}
      max={100}
      step={10}
      onchange={(e) => onGridSizeChange(parseInt(e.currentTarget.value))}
      class="w-14 px-2 py-1 rounded border border-slate-200 font-mono text-sm"
    />
    px
  </label>

  <div class="flex-1"></div>

  <Button size="sm" variant="ghost" onclick={onResetFloorplan}>
    Change Floorplan
  </Button>
</div>
