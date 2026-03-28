<script lang="ts">
	import type { Item } from '$lib/types';
	import { formatPrice } from '$lib/utils/currency';
	import { Button } from '$lib/components/ui/button';
	import * as Sheet from '$lib/components/ui/sheet';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import RotateCw from '@lucide/svelte/icons/rotate-cw';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import MapPinOff from '@lucide/svelte/icons/map-pin-off';
	import Copy from '@lucide/svelte/icons/copy';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import * as m from '$lib/paraglide/messages';
	import { formatDimension } from '$lib/utils/format';
	import ImageViewer from './ImageViewer.svelte';

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

	const formattedPrice = $derived(
		item && item.price !== null
			? formatPrice(item.price, item.priceCurrency)
			: m.item_sheet_no_price()
	);
	const dimensions = $derived(item ? formatDimension(item.width, item.height) : '');

	let showImageViewer = $state(false);
	let imageViewerIndex = $state(0);

	function openImageViewer(index: number) {
		imageViewerIndex = index;
		showImageViewer = true;
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content
		side="bottom"
		class="max-h-[60vh] rounded-t-xl px-4"
		style="padding-bottom: env(safe-area-inset-bottom);"
	>
		{#if item}
			<Sheet.Header>
				<Sheet.Title class="text-xl font-bold">{item.name}</Sheet.Title>
			</Sheet.Header>

			<div class="py-3 space-y-3 overflow-y-auto flex-1">
				<!-- Image gallery -->
				{#if item.images && item.images.length > 0}
					{#if item.images.length === 1}
						<button
							type="button"
							class="w-full h-40 rounded-lg overflow-hidden"
							onclick={() => openImageViewer(0)}
						>
							<img
								src={item.images[0].url}
								alt={item.images[0].originalName ?? m.item_form_image_alt()}
								class="w-full h-full object-cover"
							/>
						</button>
					{:else}
						<div class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
							{#each item.images as img, i (img.id)}
								<button
									type="button"
									class="flex-shrink-0 w-36 h-28 rounded-lg overflow-hidden snap-start"
									onclick={() => openImageViewer(i)}
								>
									<img
										src={img.thumbUrl}
										alt={img.originalName ?? m.item_form_image_alt()}
										class="w-full h-full object-cover"
									/>
								</button>
							{/each}
						</div>
					{/if}
				{/if}

				<!-- Info grid -->
				<div class="grid grid-cols-2 gap-3">
					<div>
						<p class="text-xs text-on-surface-variant">{m.item_sheet_price()}</p>
						<p class="text-sm font-semibold">{formattedPrice}</p>
					</div>
					<div>
						<p class="text-xs text-on-surface-variant">{m.item_sheet_dimensions()}</p>
						<p class="text-sm">{dimensions}</p>
					</div>
					<div>
						<p class="text-xs text-on-surface-variant">{m.item_sheet_color()}</p>
						<div class="flex items-center gap-1.5">
							<div
								class="w-5 h-5 rounded"
								style="background-color: {item.color}"
							></div>
							<span class="text-xs font-mono">{item.color}</span>
						</div>
					</div>
					{#if item.productUrl}
						<div>
							<p class="text-xs text-on-surface-variant">{m.item_sheet_product()}</p>
							<a
								href={item.productUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="text-secondary underline text-xs truncate block"
							>
								{m.item_sheet_view_product()}
							</a>
						</div>
					{/if}
				</div>
			</div>

			{#if !readonly}
				<!-- Quick Actions -->
				<div class="flex flex-wrap gap-2 pb-3">
					<Button
						variant="outline"
						size="icon-sm"
						class="h-11 w-11"
						onclick={() => onRotate(item.id, 'ccw')}
						title={m.item_sheet_rotate_left()}
					>
						<RotateCcw size={18} />
					</Button>
					<Button
						variant="outline"
						size="icon-sm"
						class="h-11 w-11"
						onclick={() => onRotate(item.id, 'cw')}
						title={m.item_sheet_rotate_right()}
					>
						<RotateCw size={18} />
					</Button>
					{#if item.position}
						<Button
							variant="outline"
							size="icon-sm"
							class="h-11 w-11"
							onclick={() => onUnplace(item.id)}
							title={m.item_sheet_unplace()}
						>
							<MapPinOff size={18} />
						</Button>
					{:else}
						<Button
							variant="outline"
							size="icon-sm"
							class="h-11 w-11"
							onclick={() => onPlace(item.id)}
							title={m.item_sheet_place()}
						>
							<MapPin size={18} />
						</Button>
					{/if}
					<Button
						variant="outline"
						size="icon-sm"
						class="h-11 w-11"
						onclick={() => onDuplicate(item.id)}
						title={m.item_card_duplicate()}
					>
						<Copy size={18} />
					</Button>
					<Button
						variant="destructive"
						size="icon-sm"
						class="h-11 w-11"
						onclick={() => onDelete(item.id)}
						title={m.common_delete()}
					>
						<Trash2 size={18} />
					</Button>
				</div>
			{/if}

			<Sheet.Footer class="gap-2">
				<Button variant="outline" size="lg" onclick={onClose} class="min-h-[44px]">
					{m.common_close()}
				</Button>
				{#if !readonly}
					<Button size="lg" onclick={() => onEdit(item.id)} class="min-h-[44px]">
						{m.item_form_edit_title()}
					</Button>
				{/if}
			</Sheet.Footer>
		{/if}
	</Sheet.Content>
</Sheet.Root>

{#if item?.images && item.images.length > 0}
	<ImageViewer
		images={item.images}
		initialIndex={imageViewerIndex}
		bind:open={showImageViewer}
		onClose={() => (showImageViewer = false)}
	/>
{/if}
