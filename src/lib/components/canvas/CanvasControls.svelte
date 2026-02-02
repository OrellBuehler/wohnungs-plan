<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Separator } from '$lib/components/ui/separator';

  interface Props {
    showGrid: boolean;
    snapToGrid: boolean;
    gridSize: number;
    onChangeFloorplan: () => void;
    onGridSizeChange: (size: number) => void;
    onRecalibrate: () => void;
  }

  let {
    showGrid = $bindable(),
    snapToGrid = $bindable(),
    gridSize,
    onChangeFloorplan,
    onGridSizeChange,
    onRecalibrate,
  }: Props = $props();

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
