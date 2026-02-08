<script lang="ts">
  import type { Item } from '$lib/types';
  import { getCurrencySymbol } from '$lib/utils/currency';
  import { getLShapePoints, getRectPoints } from '$lib/utils/geometry';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { Separator } from '$lib/components/ui/separator';
  import { Pencil, MapPin, MapPinOff, Copy, Trash2, ExternalLink } from 'lucide-svelte';
  import ImageViewer from './ImageViewer.svelte';

  interface Props {
    item: Item;
    isSelected: boolean;
    readonly?: boolean;
    onSelect: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onPlace: () => void;
    onUnplace: () => void;
  }

  let { item, isSelected, readonly = false, onSelect, onEdit, onDelete, onDuplicate, onPlace, onUnplace }: Props = $props();

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

  let showImageViewer = $state(false);
  let imageViewerIndex = $state(0);

  function openImageViewer(index: number) {
    imageViewerIndex = index;
    showImageViewer = true;
  }

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
      {#if item.images && item.images.length > 0}
        <img
          src={item.images[0].thumbUrl}
          alt={item.name}
          class="w-8 h-8 flex-shrink-0 rounded border border-slate-200 object-cover"
        />
      {:else}
        <svg width="32" height="32" class="flex-shrink-0 rounded border border-slate-200 bg-slate-50">
          <path d={previewPath} fill={item.color} stroke="#374151" stroke-width="0.5" />
        </svg>
      {/if}

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
            class="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
            onclick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={12} /> View
          </a>
        {/if}
      </div>
    </div>

    {#if isSelected}
      {#if item.images && item.images.length > 0}
        <Separator class="my-3" />
        <div class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
          {#each item.images as img, i (img.id)}
            <button
              type="button"
              class="flex-shrink-0 w-20 h-16 rounded border border-slate-200 overflow-hidden snap-start hover:border-blue-400 transition-colors"
              onclick={withStopPropagation(() => openImageViewer(i))}
            >
              <img src={img.thumbUrl} alt={img.originalName ?? 'Item image'} class="w-full h-full object-cover" />
            </button>
          {/each}
        </div>
      {/if}
      <Separator class="my-3" />
      <div class="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" class="min-h-[44px]" onclick={withStopPropagation(onEdit)}>
          <Pencil size={14} class="mr-1" /> Edit
        </Button>
        {#if item.position && !readonly}
          <Button size="sm" variant="outline" class="min-h-[44px]" onclick={withStopPropagation(onUnplace)}>
            <MapPinOff size={14} class="mr-1" /> Unplace
          </Button>
        {:else if !readonly}
          <Button size="sm" variant="outline" class="min-h-[44px]" onclick={withStopPropagation(onPlace)}>
            <MapPin size={14} class="mr-1" /> Place
          </Button>
        {/if}
        {#if !readonly}
          <Button size="sm" variant="outline" class="min-h-[44px]" onclick={withStopPropagation(onDuplicate)}>
            <Copy size={14} class="mr-1" /> Duplicate
          </Button>
        {/if}
        <Button size="sm" variant="destructive" class="min-h-[44px]" onclick={withStopPropagation(onDelete)}>
          <Trash2 size={14} class="mr-1" /> Delete
        </Button>
      </div>
    {/if}
  </Card.Content>
</Card.Root>

{#if item.images && item.images.length > 0}
  <ImageViewer
    images={item.images}
    initialIndex={imageViewerIndex}
    bind:open={showImageViewer}
    onClose={() => (showImageViewer = false)}
  />
{/if}
