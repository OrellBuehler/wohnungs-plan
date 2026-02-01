<script lang="ts">
  import type { Item } from '$lib/types';
  import { getCurrencySymbol } from '$lib/utils/currency';
  import { getLShapePoints, getRectPoints } from '$lib/utils/geometry';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { Separator } from '$lib/components/ui/separator';

  interface Props {
    item: Item;
    isSelected: boolean;
    onSelect: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onPlace: () => void;
  }

  let { item, isSelected, onSelect, onEdit, onDelete, onDuplicate, onPlace }: Props = $props();

  // Use the item's own currency
  const currencySymbol = $derived(getCurrencySymbol(item.priceCurrency));

  // Generate SVG path for shape preview
  const previewPath = $derived.by(() => {
    const previewSize = 32;
    const padding = 2;
    const maxDim = previewSize - padding * 2;
    const scaleX = maxDim / Math.max(item.width, 1);
    const scaleY = maxDim / Math.max(item.height, 1);
    const scale = Math.min(scaleX, scaleY);

    const w = item.width * scale;
    const h = item.height * scale;

    let points: number[];
    if (item.shape === 'l-shape' && item.cutoutWidth && item.cutoutHeight && item.cutoutCorner) {
      const cw = item.cutoutWidth * scale;
      const ch = item.cutoutHeight * scale;
      points = getLShapePoints(w, h, cw, ch, item.cutoutCorner);
    } else {
      points = getRectPoints(w, h);
    }

    // Offset to center in the preview area
    const offsetX = padding + (maxDim - w) / 2;
    const offsetY = padding + (maxDim - h) / 2;

    // Convert to SVG path
    const pathParts: string[] = [];
    for (let i = 0; i < points.length; i += 2) {
      const cmd = i === 0 ? 'M' : 'L';
      pathParts.push(`${cmd}${points[i] + offsetX},${points[i + 1] + offsetY}`);
    }
    pathParts.push('Z');
    return pathParts.join(' ');
  });

  function withStopPropagation(handler: () => void) {
    return (e: MouseEvent) => {
      e.stopPropagation();
      handler();
    };
  }
</script>

<Card.Root
  class="cursor-pointer transition-colors {isSelected
    ? 'border-blue-500 bg-blue-50'
    : 'hover:border-slate-300'}"
  onclick={onSelect}
  role="button"
  tabindex={0}
  onkeydown={(e) => e.key === 'Enter' && onSelect()}
>
  <Card.Content class="p-3">
    <div class="flex items-start gap-3">
      <svg width="32" height="32" class="flex-shrink-0 rounded border border-slate-200 bg-slate-50">
        <path d={previewPath} fill={item.color} stroke="#374151" stroke-width="0.5" />
      </svg>

      <div class="flex-1 min-w-0">
        <h3 class="font-medium text-slate-800 truncate">{item.name}</h3>
        <p class="text-sm text-slate-500 font-mono">
          {item.width} x {item.height} cm
        </p>
        {#if item.price !== null}
          <p class="text-sm font-medium text-slate-700">{currencySymbol}{item.price.toFixed(2)}</p>
        {/if}
      </div>

      <div class="flex flex-col gap-1">
        {#if item.position}
          <span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Placed</span>
        {:else}
          <span class="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Unplaced</span>
        {/if}
        {#if item.productUrl}
          <a
            href={item.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs text-blue-600 hover:underline"
            onclick={(e) => e.stopPropagation()}
          >
            View product
          </a>
        {/if}
      </div>
    </div>

    {#if isSelected}
      <Separator class="my-3" />
      <div class="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onclick={withStopPropagation(onEdit)}>
          Edit
        </Button>
        {#if !item.position}
          <Button size="sm" variant="outline" onclick={withStopPropagation(onPlace)}>
            Place
          </Button>
        {/if}
        <Button size="sm" variant="outline" onclick={withStopPropagation(onDuplicate)}>
          Duplicate
        </Button>
        <Button size="sm" variant="destructive" onclick={withStopPropagation(onDelete)}>
          Delete
        </Button>
      </div>
    {/if}
  </Card.Content>
</Card.Root>
