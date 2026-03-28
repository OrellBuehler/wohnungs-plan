<script lang="ts">
  import type { Item } from '$lib/types';
  import type { CurrencyCode } from '$lib/utils/currency';
  import { CURRENCIES, formatPrice } from '$lib/utils/currency';
  import { Button } from '$lib/components/ui/button';
  import { Separator } from '$lib/components/ui/separator';
  import * as Select from '$lib/components/ui/select';
  import Plus from '@lucide/svelte/icons/plus';
  import Package from '@lucide/svelte/icons/package';
  import * as m from '$lib/paraglide/messages';
  import ItemCard from './ItemCard.svelte';

  interface Props {
    items: Item[];
    selectedItemId: string | null;
    totalCost: number;
    displayCurrency: CurrencyCode;
    isLoadingRates: boolean;
    readonly?: boolean;
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
    readonly = false,
    onItemSelect,
    onItemEdit,
    onItemDelete,
    onItemDuplicate,
    onItemPlace,
    onItemUnplace,
    onAddItem,
    onDisplayCurrencyChange,
  }: Props = $props();

  const formattedTotal = $derived(formatPrice(totalCost, displayCurrency));

  let sortBy = $state<'name' | 'price' | 'status'>('name');
  let filterBy = $state<'all' | 'placed' | 'unplaced'>('all');

  const filterOptions = $derived([
    { value: 'all', label: m.item_filter_all() },
    { value: 'placed', label: m.item_filter_placed() },
    { value: 'unplaced', label: m.item_filter_unplaced() },
  ] as const);

  const sortOptions = $derived([
    { value: 'name', label: m.item_sort_name() },
    { value: 'price', label: m.item_sort_price() },
    { value: 'status', label: m.item_sort_status() },
  ] as const);

  const filterLabel = $derived(filterOptions.find(o => o.value === filterBy)?.label ?? m.item_filter_all());
  const sortLabel = $derived(sortOptions.find(o => o.value === sortBy)?.label ?? m.item_sort_name());

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
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-base font-semibold text-slate-800">{m.item_list_title({ count: items.length.toString() })}</h2>
      {#if !readonly}
        <Button size="sm" onclick={onAddItem}><Plus size={16} class="mr-1" /> {m.item_list_add()}</Button>
      {/if}
    </div>

    <div class="flex gap-2 text-sm">
      <Select.Root
        type="single"
        value={filterBy}
        onValueChange={(v) => (filterBy = v as typeof filterBy)}
      >
        <Select.Trigger class="w-[100px]">
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
        <Select.Trigger class="w-[90px]">
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
      <div class="flex flex-col items-center justify-center py-12 text-center">
        <Package class="size-10 text-slate-300 mb-3" />
        <p class="text-slate-500 text-sm">
          {items.length === 0 ? m.item_list_empty_new() : m.item_list_empty_filtered()}
        </p>
        {#if items.length === 0 && !readonly}
          <Button variant="outline" size="sm" class="mt-4" onclick={onAddItem}>
            <Plus size={16} class="mr-1" /> {m.item_list_add()}
          </Button>
        {/if}
      </div>
    {:else}
      {#each filteredItems as item (item.id)}
        <ItemCard
          {item}
          {readonly}
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
        <span class="text-sm text-slate-600">{m.item_list_total()}</span>
        <Select.Root
          type="single"
          value={displayCurrency}
          onValueChange={(v) => onDisplayCurrencyChange(v as CurrencyCode)}
        >
          <Select.Trigger class="w-[90px] h-8 text-xs">
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
          <span class="text-xs text-slate-400">{m.item_list_updating()}</span>
        {/if}
        <span class="text-lg font-semibold text-slate-800">{formattedTotal}</span>
      </div>
    </div>
  </div>
</div>
