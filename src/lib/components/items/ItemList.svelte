<script lang="ts">
  import type { Item } from '$lib/types';
  import type { CurrencyCode } from '$lib/utils/currency';
  import { CURRENCIES, getCurrencySymbol } from '$lib/utils/currency';
  import { Button } from '$lib/components/ui/button';
  import { Separator } from '$lib/components/ui/separator';
  import * as Select from '$lib/components/ui/select';
  import { Plus } from 'lucide-svelte';
  import ItemCard from './ItemCard.svelte';

  interface Props {
    items: Item[];
    selectedItemId: string | null;
    totalCost: number;
    displayCurrency: CurrencyCode;
    isLoadingRates: boolean;
    onItemSelect: (id: string | null) => void;
    onItemEdit: (id: string) => void;
    onItemDelete: (id: string) => void;
    onItemDuplicate: (id: string) => void;
    onItemPlace: (id: string) => void;
    onItemUnplace: (id: string) => void;
    onAddItem: () => void;
    onDisplayCurrencyChange: (currency: CurrencyCode) => void;
  }

  let {
    items,
    selectedItemId,
    totalCost,
    displayCurrency,
    isLoadingRates,
    onItemSelect,
    onItemEdit,
    onItemDelete,
    onItemDuplicate,
    onItemPlace,
    onItemUnplace,
    onAddItem,
    onDisplayCurrencyChange,
  }: Props = $props();

  const currencySymbol = $derived(getCurrencySymbol(displayCurrency));

  let sortBy = $state<'name' | 'price' | 'status'>('name');
  let filterBy = $state<'all' | 'placed' | 'unplaced'>('all');

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'placed', label: 'Placed' },
    { value: 'unplaced', label: 'Unplaced' },
  ] as const;

  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'price', label: 'Price' },
    { value: 'status', label: 'Status' },
  ] as const;

  const filterLabel = $derived(filterOptions.find(o => o.value === filterBy)?.label ?? 'All');
  const sortLabel = $derived(sortOptions.find(o => o.value === sortBy)?.label ?? 'Name');

  const filteredItems = $derived.by(() => {
    let result = [...items];

    if (filterBy === 'placed') {
      result = result.filter(i => i.position !== null);
    } else if (filterBy === 'unplaced') {
      result = result.filter(i => i.position === null);
    }

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

<div class="flex flex-col h-full min-h-0">
  <div class="flex-shrink-0 p-4">
    <div class="flex items-center justify-between mb-3">
      <h2 class="font-semibold text-slate-800">Items ({items.length})</h2>
      <Button size="sm" onclick={onAddItem}><Plus size={16} class="mr-1" /> Add</Button>
    </div>

    <div class="flex gap-2 text-sm">
      <Select.Root
        type="single"
        value={filterBy}
        onValueChange={(v) => (filterBy = v as typeof filterBy)}
      >
        <Select.Trigger class="w-[100px] h-8">
          {filterLabel}
        </Select.Trigger>
        <Select.Content>
          {#each filterOptions as option (option.value)}
            <Select.Item value={option.value}>{option.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>

      <Select.Root
        type="single"
        value={sortBy}
        onValueChange={(v) => (sortBy = v as typeof sortBy)}
      >
        <Select.Trigger class="w-[90px] h-8">
          {sortLabel}
        </Select.Trigger>
        <Select.Content>
          {#each sortOptions as option (option.value)}
            <Select.Item value={option.value}>{option.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>
  </div>

  <Separator />

  <div class="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
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
          onUnplace={() => onItemUnplace(item.id)}
        />
      {/each}
    {/if}
  </div>

  <Separator />

  <div class="flex-shrink-0 p-4 bg-slate-50">
    <div class="flex justify-between items-center">
      <div class="flex items-center gap-2">
        <span class="text-sm text-slate-600">Total</span>
        <Select.Root
          type="single"
          value={displayCurrency}
          onValueChange={(v) => onDisplayCurrencyChange(v as CurrencyCode)}
        >
          <Select.Trigger class="w-[90px] h-7 text-xs">
            {displayCurrency}
          </Select.Trigger>
          <Select.Content>
            {#each CURRENCIES as curr (curr.code)}
              <Select.Item value={curr.code}>{curr.symbol} {curr.code}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
      <div class="flex items-center gap-2">
        {#if isLoadingRates}
          <span class="text-xs text-slate-400">updating...</span>
        {/if}
        <span class="text-lg font-semibold text-slate-800">{currencySymbol}{totalCost.toFixed(2)}</span>
      </div>
    </div>
  </div>
</div>
