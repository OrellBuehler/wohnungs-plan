<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { isPlacementMode, exitPlacementMode } from '$lib/stores/comments.svelte';

	interface Props {
		isMobile: boolean;
		onPlace: (screenX: number, screenY: number) => void;
	}

	let { isMobile, onPlace }: Props = $props();

	const active = $derived(isPlacementMode());

	function handlePlaceMobile() {
		const x = window.innerWidth / 2;
		const y = window.innerHeight / 2;
		onPlace(x, y);
	}
</script>

{#if active}
	{#if isMobile}
		<!-- Mobile: Crosshair + buttons -->
		<div class="fixed inset-0 z-50 pointer-events-none">
			<!-- Crosshair at center -->
			<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
				<div class="w-8 h-8 border-2 border-indigo-500 rounded-full"></div>
				<div class="absolute top-1/2 left-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 bg-indigo-500 rounded-full"></div>
			</div>

			<!-- Buttons at bottom -->
			<div
				class="absolute bottom-0 left-0 right-0 flex gap-3 justify-center p-4 bg-white/90 backdrop-blur-sm pointer-events-auto"
				style="padding-bottom: calc(env(safe-area-inset-bottom) + 1rem);"
			>
				<Button variant="outline" onclick={exitPlacementMode}>Cancel</Button>
				<Button onclick={handlePlaceMobile}>Place Comment</Button>
			</div>
		</div>
	{:else}
		<!-- Desktop: Banner -->
		<div class="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-3 text-sm">
			Click on the floorplan to place a comment
			<Button variant="secondary" size="sm" onclick={exitPlacementMode}>Cancel</Button>
		</div>
	{/if}
{/if}
