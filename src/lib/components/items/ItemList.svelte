<script lang="ts">
  import type { Item } from '$lib/types';
  import { Button } from '$lib/components/ui/button';
  import ItemCard from './ItemCard.svelte';

  interface Props {
    items: Item[];
    selectedItemId: string | null;
    totalCost: number;
    onItemSelect: (id: string | null) => void;
    onItemEdit: (id: string) => void;
    onItemDelete: (id: string) => void;
    onItemDuplicate: (id: string) => void;
    onItemPlace: (id: string) => void;
    onAddItem: () => void;
  }

  let {
    items,
    selectedItemId,
    totalCost,
    onItemSelect,
    onItemEdit,
    onItemDelete,
    onItemDuplicate,
    onItemPlace,
    onAddItem,
  }: Props = $props();

  let sortBy = $state<'name' | 'price' | 'status'>('name');
  let filterBy = $state<'all' | 'placed' | 'unplaced'>('all');

  const filteredItems = $derived.by(() => {
    let result = [...items];

    // Filter
    if (filterBy === 'placed') {
      result = result.filter(i => i.position !== null);
    } else if (filterBy === 'unplaced') {
      result = result.filter(i => i.position === null);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'price') return (b.price ?? 0) - (a.price ?? 0);
      if (sortBy === 'status') {
        const aPlaced = a.position !== null ? 1 : 0;
        const bPlaced = b.position !== null ? 1 : 0;
        return bPlaced - aPlaced;
      }
      return 0;
    });

    return result;
  });
</script>

<div class="flex flex-col h-full">
  <div class="p-4 border-b border-slate-200">
    <div class="flex items-center justify-between mb-3">
      <h2 class="font-semibold text-slate-800">Items ({items.length})</h2>
      <Button size="sm" onclick={onAddItem}>+ Add</Button>
    </div>

    <div class="flex gap-2 text-sm">
      <select
        class="px-2 py-1 rounded border border-slate-200 text-slate-600 bg-white"
        bind:value={filterBy}
      >
        <option value="all">All</option>
        <option value="placed">Placed</option>
        <option value="unplaced">Unplaced</option>
      </select>
      <select
        class="px-2 py-1 rounded border border-slate-200 text-slate-600 bg-white"
        bind:value={sortBy}
      >
        <option value="name">Name</option>
        <option value="price">Price</option>
        <option value="status">Status</option>
      </select>
    </div>
  </div>

  <div class="flex-1 overflow-y-auto p-4 space-y-2">
    {#if filteredItems.length === 0}
      <p class="text-slate-500 text-sm text-center py-8">
        {items.length === 0 ? 'No items yet. Add your first item!' : 'No items match filter.'}
      </p>
    {:else}
      {#each filteredItems as item (item.id)}
        <ItemCard
          {item}
          isSelected={selectedItemId === item.id}
          onSelect={() => onItemSelect(item.id)}
          onEdit={() => onItemEdit(item.id)}
          onDelete={() => onItemDelete(item.id)}
          onDuplicate={() => onItemDuplicate(item.id)}
          onPlace={() => onItemPlace(item.id)}
        />
      {/each}
    {/if}
  </div>

  <div class="p-4 border-t border-slate-200 bg-slate-50">
    <div class="flex justify-between items-center">
      <span class="text-sm text-slate-600">Total Cost</span>
      <span class="text-lg font-semibold text-slate-800">€{totalCost.toFixed(2)}</span>
    </div>
  </div>
</div>
