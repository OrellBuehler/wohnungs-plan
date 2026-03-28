<script lang="ts">
	import type { Item } from '$lib/types';
	import { formatPrice } from '$lib/utils/currency';
	import { getLShapePoints, getRectPoints } from '$lib/utils/geometry';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import Pencil from '@lucide/svelte/icons/pencil';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import MapPinOff from '@lucide/svelte/icons/map-pin-off';
	import Copy from '@lucide/svelte/icons/copy';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import * as m from '$lib/paraglide/messages';
	import { formatDimension } from '$lib/utils/format';
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

	let {
		item,
		isSelected,
		readonly = false,
		onSelect,
		onEdit,
		onDelete,
		onDuplicate,
		onPlace,
		onUnplace
	}: Props = $props();

	// Use the item's own currency for locale-aware formatting
	const formattedPrice = $derived(
		item.price !== null ? formatPrice(item.price, item.priceCurrency) : null
	);

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
	class="cursor-pointer transition-all active:scale-[0.98] {isSelected
		? 'border-secondary bg-secondary-fixed'
		: ''}"
	onclick={onSelect}
	role="button"
	tabindex={0}
	onkeydown={(e) => e.key === 'Enter' && onSelect()}
>
	<Card.Content class="p-4">
		<div class="flex items-start gap-3">
			{#if item.images && item.images.length > 0}
				<img
					src={item.images[0].thumbUrl}
					alt={item.name}
					class="w-8 h-8 flex-shrink-0 rounded object-cover"
				/>
			{:else}
				<svg
					width="32"
					height="32"
					class="flex-shrink-0 rounded bg-surface"
				>
					<path d={previewPath} fill={item.color} stroke="#374151" stroke-width="0.5" />
				</svg>
			{/if}

			<div class="flex-1 min-w-0">
				<h3 class="font-medium text-on-surface truncate">{item.name}</h3>
				<p class="text-sm text-on-surface-variant font-technical">
					{formatDimension(item.width, item.height)}
				</p>
				{#if formattedPrice}
					<p class="text-sm font-medium text-on-surface">{formattedPrice}</p>
				{/if}
			</div>

			<div class="flex flex-col gap-1">
				{#if item.position}
					<span class="text-xs bg-secondary-fixed text-on-secondary-fixed-variant px-2 py-0.5 rounded"
						>{m.item_card_placed()}</span
					>
				{:else}
					<span class="text-xs bg-surface-container text-on-surface-variant px-2 py-0.5 rounded"
						>{m.item_card_unplaced()}</span
					>
				{/if}
				{#if item.productUrl}
					<a
						href={item.productUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="text-xs text-secondary hover:underline inline-flex items-center gap-1"
						onclick={(e) => e.stopPropagation()}
					>
						<ExternalLink size={12} />
						{m.item_card_view()}
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
							class="flex-shrink-0 w-20 h-16 rounded overflow-hidden snap-start hover:border-secondary transition-colors"
							onclick={withStopPropagation(() => openImageViewer(i))}
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
			<Separator class="my-3" />
			<div class="flex flex-wrap gap-2">
				<Button
					size="sm"
					variant="outline"
					class="min-h-[44px]"
					onclick={withStopPropagation(onEdit)}
				>
					<Pencil size={14} class="mr-1" />
					{m.common_edit()}
				</Button>
				{#if item.position && !readonly}
					<Button
						size="sm"
						variant="outline"
						class="min-h-[44px]"
						onclick={withStopPropagation(onUnplace)}
					>
						<MapPinOff size={14} class="mr-1" />
						{m.item_card_unplace()}
					</Button>
				{:else if !readonly}
					<Button
						size="sm"
						variant="outline"
						class="min-h-[44px]"
						onclick={withStopPropagation(onPlace)}
					>
						<MapPin size={14} class="mr-1" />
						{m.item_card_place()}
					</Button>
				{/if}
				{#if !readonly}
					<Button
						size="sm"
						variant="outline"
						class="min-h-[44px]"
						onclick={withStopPropagation(onDuplicate)}
					>
						<Copy size={14} class="mr-1" />
						{m.item_card_duplicate()}
					</Button>
				{/if}
				<Button
					size="sm"
					variant="destructive"
					class="min-h-[44px]"
					onclick={withStopPropagation(onDelete)}
				>
					<Trash2 size={14} class="mr-1" />
					{m.common_delete()}
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
