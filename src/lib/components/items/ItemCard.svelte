<script lang="ts">
  import type { Item } from '$lib/types';
  import { Button } from '$lib/components/ui/button';

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
</script>

<div
  class="p-3 rounded-lg border transition-colors cursor-pointer {isSelected
    ? 'border-blue-500 bg-blue-50'
    : 'border-slate-200 hover:border-slate-300 bg-white'}"
  onclick={onSelect}
  role="button"
  tabindex="0"
  onkeydown={(e) => e.key === 'Enter' && onSelect()}
>
  <div class="flex items-start gap-3">
    <!-- Color swatch -->
    <div
      class="w-8 h-8 rounded flex-shrink-0"
      style="background-color: {item.color}"
    ></div>

    <div class="flex-1 min-w-0">
      <h3 class="font-medium text-slate-800 truncate">{item.name}</h3>
      <p class="text-sm text-slate-500 font-mono">
        {item.width} × {item.height} cm
      </p>
      {#if item.price !== null}
        <p class="text-sm font-medium text-slate-700">€{item.price.toFixed(2)}</p>
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
    <div class="flex gap-2 mt-3 pt-3 border-t border-slate-200">
      <Button size="sm" variant="outline" onclick={(e: MouseEvent) => { e.stopPropagation(); onEdit(); }}>
        Edit
      </Button>
      {#if !item.position}
        <Button size="sm" variant="outline" onclick={(e: MouseEvent) => { e.stopPropagation(); onPlace(); }}>
          Place
        </Button>
      {/if}
      <Button size="sm" variant="outline" onclick={(e: MouseEvent) => { e.stopPropagation(); onDuplicate(); }}>
        Duplicate
      </Button>
      <Button size="sm" variant="destructive" onclick={(e: MouseEvent) => { e.stopPropagation(); onDelete(); }}>
        Delete
      </Button>
    </div>
  {/if}
</div>
