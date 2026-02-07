<script lang="ts">
	import type { Item } from '$lib/types';
	import { getCurrencySymbol } from '$lib/utils/currency';
	import { Button } from '$lib/components/ui/button';
	import * as Sheet from '$lib/components/ui/sheet';
	import { RotateCcw, RotateCw, MapPin, MapPinOff, Copy, Trash2 } from 'lucide-svelte';

	interface Props {
		open: boolean;
		item: Item | null;
		onEdit: (id: string) => void;
		onClose: () => void;
		onRotate: (id: string, direction: 'cw' | 'ccw') => void;
		onDelete: (id: string) => void;
		onDuplicate: (id: string) => void;
		onPlace: (id: string) => void;
		onUnplace: (id: string) => void;
	}

	let { open = $bindable(), item, onEdit, onClose, onRotate, onDelete, onDuplicate, onPlace, onUnplace }: Props = $props();

	const currencySymbol = $derived(item ? getCurrencySymbol(item.priceCurrency) : '');
	const formattedPrice = $derived(
		item && item.price !== null ? `${currencySymbol}${item.price.toFixed(2)}` : 'No price'
	);
	const dimensions = $derived(
		item ? `${item.width} × ${item.height} cm` : ''
	);
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="bottom" class="max-h-[60vh]" style="padding-bottom: env(safe-area-inset-bottom);">
		{#if item}
			<Sheet.Header>
				<Sheet.Title class="text-xl font-bold">{item.name}</Sheet.Title>
			</Sheet.Header>

			<div class="py-4 space-y-4 overflow-y-auto flex-1">
				<!-- Price -->
				<div>
					<p class="text-sm text-slate-500">Price</p>
					<p class="text-lg font-semibold">{formattedPrice}</p>
				</div>

				<!-- Dimensions -->
				<div>
					<p class="text-sm text-slate-500">Dimensions</p>
					<p class="text-lg">{dimensions}</p>
				</div>

				<!-- Product URL -->
				{#if item.productUrl}
					<div>
						<p class="text-sm text-slate-500">Product URL</p>
						<a
							href={item.productUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="text-blue-600 underline text-sm break-all"
						>
							{item.productUrl}
						</a>
					</div>
				{/if}

				<!-- Color preview -->
				<div>
					<p class="text-sm text-slate-500">Color</p>
					<div class="flex items-center gap-2">
						<div
							class="w-8 h-8 rounded border border-slate-200"
							style="background-color: {item.color}"
						></div>
						<span class="text-sm font-mono">{item.color}</span>
					</div>
				</div>
			</div>

			<!-- Quick Actions -->
			<div class="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
				<Button variant="outline" size="sm" class="min-h-[44px] min-w-[44px] flex-shrink-0" onclick={() => onRotate(item.id, 'ccw')}>
					<RotateCcw size={16} class="mr-1.5" /> Left
				</Button>
				<Button variant="outline" size="sm" class="min-h-[44px] min-w-[44px] flex-shrink-0" onclick={() => onRotate(item.id, 'cw')}>
					<RotateCw size={16} class="mr-1.5" /> Right
				</Button>
				{#if item.position}
					<Button variant="outline" size="sm" class="min-h-[44px] min-w-[44px] flex-shrink-0" onclick={() => onUnplace(item.id)}>
						<MapPinOff size={16} class="mr-1.5" /> Unplace
					</Button>
				{:else}
					<Button variant="outline" size="sm" class="min-h-[44px] min-w-[44px] flex-shrink-0" onclick={() => onPlace(item.id)}>
						<MapPin size={16} class="mr-1.5" /> Place
					</Button>
				{/if}
				<Button variant="outline" size="sm" class="min-h-[44px] min-w-[44px] flex-shrink-0" onclick={() => onDuplicate(item.id)}>
					<Copy size={16} class="mr-1.5" /> Copy
				</Button>
				<Button variant="destructive" size="sm" class="min-h-[44px] min-w-[44px] flex-shrink-0" onclick={() => onDelete(item.id)}>
					<Trash2 size={16} class="mr-1.5" /> Delete
				</Button>
			</div>

			<Sheet.Footer class="gap-2">
				<Button variant="outline" size="lg" onclick={onClose} class="min-h-[44px]">
					Close
				</Button>
				<Button size="lg" onclick={() => onEdit(item.id)} class="min-h-[44px]">
					Edit Item
				</Button>
			</Sheet.Footer>
		{/if}
	</Sheet.Content>
</Sheet.Root>
