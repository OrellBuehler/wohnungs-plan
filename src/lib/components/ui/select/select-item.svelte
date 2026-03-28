<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import Check from '@lucide/svelte/icons/check';
	import type { Snippet } from 'svelte';

	type ItemSnippetProps = { selected: boolean; highlighted: boolean };

	let {
		ref = $bindable(null),
		class: className,
		children: userChildren,
		...restProps
	}: SelectPrimitive.ItemProps & {
		children?: Snippet<[ItemSnippetProps]> | Snippet<[]>;
	} = $props();
</script>

<SelectPrimitive.Item
	bind:ref
	data-slot="select-item"
	class={cn(
		'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
		className
	)}
	{...restProps}
>
	{#snippet children({ selected, highlighted })}
		<span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
			{#if selected}
				<Check class="h-4 w-4" />
			{/if}
		</span>
		{#if userChildren}
			{@render userChildren({ selected, highlighted })}
		{/if}
	{/snippet}
</SelectPrimitive.Item>
