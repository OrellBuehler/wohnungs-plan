<script lang="ts">
	import type { Item } from '$lib/types';
	import type { CurrencyCode } from '$lib/utils/currency';
	import { CURRENCIES, formatPrice } from '$lib/utils/currency';
	import { Button } from '$lib/components/ui/button';
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
		onDisplayCurrencyChange
	}: Props = $props();

	const formattedTotal = $derived(formatPrice(totalCost, displayCurrency));

	let sortBy = $state<'name' | 'price' | 'status'>('name');
	let filterBy = $state<'all' | 'placed' | 'unplaced'>('all');

	const filterOptions = $derived([
		{ value: 'all', label: m.item_filter_all() },
		{ value: 'placed', label: m.item_filter_placed() },
		{ value: 'unplaced', label: m.item_filter_unplaced() }
	] as const);

	const sortOptions = $derived([
		{ value: 'name', label: m.item_sort_name() },
		{ value: 'price', label: m.item_sort_price() },
		{ value: 'status', label: m.item_sort_status() }
	] as const);

	const filterLabel = $derived(
		filterOptions.find((o) => o.value === filterBy)?.label ?? m.item_filter_all()
	);
	const sortLabel = $derived(
		sortOptions.find((o) => o.value === sortBy)?.label ?? m.item_sort_name()
	);

	const filteredItems = $derived.by(() => {
		let result = [...items];

		if (filterBy === 'placed') {
			result = result.filter((i) => i.position !== null);
		} else if (filterBy === 'unplaced') {
			result = result.filter((i) => i.position === null);
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
	<!-- Header: title + add -->
	<div class="flex-shrink-0 px-4 pt-4 pb-3">
		<div class="flex items-center justify-between">
			<h2 class="font-display text-base font-semibold text-on-surface">
				{m.item_list_title({ count: items.length.toString() })}
			</h2>
			{#if !readonly}
				<Button size="sm" onclick={onAddItem}
					><Plus size={16} class="mr-1" /> {m.item_list_add()}</Button
				>
			{/if}
		</div>
	</div>

	<!-- Filters -->
	<div class="flex-shrink-0 flex gap-2 px-4 pb-3 text-sm">
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

		<Select.Root type="single" value={sortBy} onValueChange={(v) => (sortBy = v as typeof sortBy)}>
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

	<!-- Item list -->
	<div class="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-2">
		{#if filteredItems.length === 0}
			<div class="flex flex-col items-center justify-center py-12 text-center px-2">
				{#if items.length === 0}
					<svg viewBox="0 0 80 60" class="w-20 mb-4" fill="none" xmlns="http://www.w3.org/2000/svg">
						<rect
							x="8"
							y="24"
							width="28"
							height="14"
							rx="2"
							class="fill-surface-container-high stroke-outline"
							stroke-width="1"
						/>
						<rect
							x="44"
							y="28"
							width="20"
							height="14"
							rx="1.5"
							class="fill-surface-container-high stroke-outline"
							stroke-width="1"
						/>
						<circle
							cx="64"
							cy="14"
							r="10"
							class="fill-secondary/15 stroke-secondary"
							stroke-width="1.5"
						/>
						<path
							d="M64 9 L64 19 M59 14 L69 14"
							class="stroke-secondary"
							stroke-width="1.5"
							stroke-linecap="round"
						/>
					</svg>
					<p class="text-on-surface-variant text-sm mb-1">{m.item_list_empty_title()}</p>
					<p class="text-outline text-xs mb-4">{m.item_list_empty_hint()}</p>
					{#if !readonly}
						<Button variant="outline" size="sm" onclick={onAddItem}>
							<Plus size={16} class="mr-1" />
							{m.item_list_add()}
						</Button>
					{/if}
				{:else}
					<Package class="size-10 text-outline mb-3" />
					<p class="text-on-surface-variant text-sm">
						{m.item_list_empty_filtered()}
					</p>
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

	<!-- Total cost footer -->
	<div class="flex-shrink-0 px-4 py-3 bg-surface-container">
		<div class="flex justify-between items-center">
			<div class="flex items-center gap-2">
				<span class="text-sm text-on-surface-variant">{m.item_list_total()}</span>
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
					<span class="text-xs text-outline">{m.item_list_updating()}</span>
				{/if}
				<span class="font-technical text-xl font-semibold text-on-surface">{formattedTotal}</span>
			</div>
		</div>
	</div>
</div>
