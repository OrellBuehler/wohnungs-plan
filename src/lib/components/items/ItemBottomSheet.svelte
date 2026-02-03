<script lang="ts">
	import type { Item } from '$lib/types';
	import { getCurrencySymbol } from '$lib/utils/currency';
	import { Button } from '$lib/components/ui/button';
	import * as Sheet from '$lib/components/ui/sheet';

	interface Props {
		open: boolean;
		item: Item | null;
		onEdit: (id: string) => void;
		onClose: () => void;
	}

	let { open = $bindable(), item, onEdit, onClose }: Props = $props();

	const currencySymbol = $derived(item ? getCurrencySymbol(item.priceCurrency) : '');
	const formattedPrice = $derived(
		item && item.price !== null ? `${currencySymbol}${item.price.toFixed(2)}` : 'No price'
	);
	const dimensions = $derived(
		item ? `${item.width} × ${item.height} cm` : ''
	);
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="bottom" class="h-[40vh]">
		{#if item}
			<Sheet.Header>
				<Sheet.Title class="text-xl font-bold">{item.name}</Sheet.Title>
			</Sheet.Header>

			<div class="py-4 space-y-4">
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
