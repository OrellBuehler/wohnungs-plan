<script lang="ts">
	interface Props {
		x: number;
		y: number;
		color: string;
		name: string | null;
		showLabel?: boolean;
	}

	let { x, y, color, name, showLabel = true }: Props = $props();

	// Label fades out after 2 seconds of no movement
	let labelVisible = $state(true);
	let fadeTimeout: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		// Reset visibility on position change
		labelVisible = true;
		if (fadeTimeout) clearTimeout(fadeTimeout);
		fadeTimeout = setTimeout(() => {
			labelVisible = false;
		}, 2000);

		return () => {
			if (fadeTimeout) clearTimeout(fadeTimeout);
		};
	});
</script>

<g transform="translate({x}, {y})" class="pointer-events-none">
	<!-- Cursor arrow -->
	<path
		d="M0 0 L0 16 L4 12 L8 20 L10 19 L6 11 L12 11 Z"
		fill={color}
		stroke="white"
		stroke-width="1"
	/>

	<!-- Name label -->
	{#if showLabel && name}
		<g
			transform="translate(14, 16)"
			class="transition-opacity duration-300"
			style:opacity={labelVisible ? 1 : 0}
		>
			<rect x="-2" y="-10" width={name.length * 7 + 8} height="14" rx="3" fill={color} />
			<text x="2" y="0" fill="white" font-size="10" font-family="system-ui, sans-serif">
				{name}
			</text>
		</g>
	{/if}
</g>
