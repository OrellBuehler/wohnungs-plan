<script lang="ts">
	import type { Item } from '$lib/types';
	import { getCurrencySymbol } from '$lib/utils/currency';
	import { Button } from '$lib/components/ui/button';
	import * as Sheet from '$lib/components/ui/sheet';
	import { RotateCcw, RotateCw, MapPin, MapPinOff, Copy, Trash2 } from 'lucide-svelte';

	interface Props {
		open: boolean;
		item: Item | null;
		readonly?: boolean;
		onEdit: (id: string) => void;
		onClose: () => void;
		onRotate: (id: string, direction: 'cw' | 'ccw') => void;
		onDelete: (id: string) => void;
		onDuplicate: (id: string) => void;
		onPlace: (id: string) => void;
		onUnplace: (id: string) => void;
	}

	let {
		open = $bindable(),
		item,
		readonly = false,
		onEdit,
		onClose,
		onRotate,
		onDelete,
		onDuplicate,
		onPlace,
		onUnplace
	}: Props = $props();

	const currencySymbol = $derived(item ? getCurrencySymbol(item.priceCurrency) : '');
	const formattedPrice = $derived(
		item && item.price !== null ? `${currencySymbol}${item.price.toFixed(2)}` : 'No price'
	);
	const dimensions = $derived(
		item ? `${item.width} × ${item.height} cm` : ''
	);
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="bottom" class="max-h-[60vh] rounded-t-xl px-4" style="padding-bottom: env(safe-area-inset-bottom);">
		{#if item}
			<Sheet.Header>
				<Sheet.Title class="text-xl font-bold">{item.name}</Sheet.Title>
			</Sheet.Header>

			<div class="py-3 space-y-3 overflow-y-auto flex-1">
				<!-- Info grid -->
				<div class="grid grid-cols-2 gap-3">
					<div>
						<p class="text-xs text-slate-500">Price</p>
						<p class="text-sm font-semibold">{formattedPrice}</p>
					</div>
					<div>
						<p class="text-xs text-slate-500">Dimensions</p>
						<p class="text-sm">{dimensions}</p>
					</div>
					<div>
						<p class="text-xs text-slate-500">Color</p>
						<div class="flex items-center gap-1.5">
							<div
								class="w-5 h-5 rounded border border-slate-200"
								style="background-color: {item.color}"
							></div>
							<span class="text-xs font-mono">{item.color}</span>
						</div>
					</div>
					{#if item.productUrl}
						<div>
							<p class="text-xs text-slate-500">Product</p>
							<a
								href={item.productUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="text-blue-600 underline text-xs truncate block"
							>
								View product
							</a>
						</div>
					{/if}
				</div>
			</div>

			{#if !readonly}
				<!-- Quick Actions -->
				<div class="flex flex-wrap gap-1.5 pb-3">
					<Button variant="outline" size="icon-sm" class="h-9 w-9" onclick={() => onRotate(item.id, 'ccw')} title="Rotate left">
						<RotateCcw size={16} />
					</Button>
					<Button variant="outline" size="icon-sm" class="h-9 w-9" onclick={() => onRotate(item.id, 'cw')} title="Rotate right">
						<RotateCw size={16} />
					</Button>
					{#if item.position}
						<Button variant="outline" size="icon-sm" class="h-9 w-9" onclick={() => onUnplace(item.id)} title="Remove from plan">
							<MapPinOff size={16} />
						</Button>
					{:else}
						<Button variant="outline" size="icon-sm" class="h-9 w-9" onclick={() => onPlace(item.id)} title="Place on plan">
							<MapPin size={16} />
						</Button>
					{/if}
					<Button variant="outline" size="icon-sm" class="h-9 w-9" onclick={() => onDuplicate(item.id)} title="Duplicate">
						<Copy size={16} />
					</Button>
					<Button variant="destructive" size="icon-sm" class="h-9 w-9" onclick={() => onDelete(item.id)} title="Delete">
						<Trash2 size={16} />
					</Button>
				</div>
			{/if}

			<Sheet.Footer class="gap-2">
				<Button variant="outline" size="lg" onclick={onClose} class="min-h-[44px]">
					Close
				</Button>
				{#if !readonly}
					<Button size="lg" onclick={() => onEdit(item.id)} class="min-h-[44px]">
						Edit Item
					</Button>
				{/if}
			</Sheet.Footer>
		{/if}
	</Sheet.Content>
</Sheet.Root>
