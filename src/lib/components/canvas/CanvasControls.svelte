<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import * as m from '$lib/paraglide/messages';
	import { formatDecimal } from '$lib/utils/format';
	import {
		getFloorplanAnalysis,
		toggleWallsDoors,
		hasFloorplanAnalysis
	} from '$lib/stores/project.svelte';
	import {
		isCommentsVisible,
		toggleCommentsVisibility,
		getComments
	} from '$lib/stores/comments.svelte';

	interface Props {
		showGrid: boolean;
		snapToGrid: boolean;
		gridSize: number;
		scale: number;
		onChangeFloorplan: () => void;
		onGridSizeChange: (size: number) => void;
		onRecalibrate: () => void;
	}

	let {
		showGrid = $bindable(),
		snapToGrid = $bindable(),
		gridSize,
		scale,
		onChangeFloorplan,
		onGridSizeChange,
		onRecalibrate
	}: Props = $props();

	// Floorplan analysis state
	const floorplanAnalysis = $derived(getFloorplanAnalysis());
	const hasAnalysis = $derived(hasFloorplanAnalysis());
	const showWallsDoors = $derived(floorplanAnalysis.visible);

	// Comments state
	const showComments = $derived(isCommentsVisible());
	const commentCount = $derived(getComments().filter((c) => !c.resolved).length);

	function handleGridSizeInput(e: Event) {
		const value = parseInt((e.target as HTMLInputElement).value, 10);
		if (!isNaN(value)) {
			onGridSizeChange(value);
		}
	}
</script>

<div
	class="bg-white/80 backdrop-blur-[12px] rounded-lg px-3 py-2 flex items-center gap-3 text-sm"
>
	<div class="flex items-center gap-3">
		<Label class="flex items-center gap-2 text-on-surface-variant cursor-pointer">
			<Checkbox bind:checked={showGrid} />
			{m.canvas_control_grid()}
		</Label>

		<Label class="flex items-center gap-2 text-on-surface-variant cursor-pointer">
			<Checkbox bind:checked={snapToGrid} />
			{m.canvas_control_snap()}
		</Label>

		{#if hasAnalysis}
			<Label
				class="flex items-center gap-2 text-on-surface-variant cursor-pointer"
				title={m.canvas_control_walls_doors_title()}
			>
				<Checkbox checked={showWallsDoors} onCheckedChange={() => toggleWallsDoors()} />
				{m.canvas_control_walls_doors()}
			</Label>
		{/if}

		<Label class="flex items-center gap-2 text-on-surface-variant cursor-pointer">
			<Checkbox checked={showComments} onCheckedChange={() => toggleCommentsVisibility()} />
			{m.canvas_control_comments()}
		</Label>

		<Separator orientation="vertical" class="h-5" />

		<Label class="flex items-center gap-2 text-on-surface-variant">
			{m.canvas_control_gridsize()}
			<Input
				type="number"
				value={gridSize}
				oninput={handleGridSizeInput}
				min={1}
				max={200}
				step={1}
				class="w-14 h-7 font-technical text-sm"
			/>
			{m.canvas_control_px()}
		</Label>
	</div>

	<div class="flex-1"></div>

	<div class="flex items-center gap-2">
		{#if hasAnalysis && showWallsDoors}
			<span class="text-xs text-on-surface-variant/70 font-technical">
				{m.canvas_control_analysis({
					walls: floorplanAnalysis.walls.length.toString(),
					doors: floorplanAnalysis.doors.length.toString()
				})}
			</span>
		{/if}

		{#if showComments && commentCount > 0}
			<span class="text-xs text-on-surface-variant/70 font-technical">
				{m.canvas_control_comments_count({ count: commentCount.toString() })}
			</span>
		{/if}

		<span class="text-xs text-outline font-technical">
			{formatDecimal(scale, 2)} px/cm
		</span>
	</div>

	<Separator orientation="vertical" class="h-5" />

	<div class="flex items-center gap-1">
		<Button
			variant="ghost"
			size="sm"
			class="h-7 px-2 text-xs text-on-surface-variant hover:text-on-surface"
			onclick={onRecalibrate}
		>
			{m.canvas_control_recalibrate()}
		</Button>

		<Button
			variant="ghost"
			size="sm"
			class="h-7 px-2 text-xs text-on-surface-variant hover:text-on-surface"
			onclick={onChangeFloorplan}
		>
			{m.canvas_control_change_floorplan()}
		</Button>
	</div>
</div>
