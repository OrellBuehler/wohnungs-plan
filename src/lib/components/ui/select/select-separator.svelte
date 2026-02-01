<script lang="ts">
	import { cn } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		class: className,
		...restProps
	}: HTMLAttributes<HTMLDivElement> = $props();
</script>

<div
	data-slot="select-separator"
	class={cn("bg-muted -mx-1 my-1 h-px", className)}
	{...restProps}
></div>
