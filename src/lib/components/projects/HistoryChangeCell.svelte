<script lang="ts">
	import type { ItemChange } from '$lib/types';

	let {
		action,
		field,
		oldValue,
		newValue
	}: Pick<ItemChange, 'action' | 'field' | 'oldValue' | 'newValue'> = $props();

	const isImageAdd = $derived(field === 'image' && oldValue === null && newValue !== null);
</script>

{#if action !== 'update'}
	<span class="text-muted-foreground">&mdash;</span>
{:else if field === 'image'}
	{#if isImageAdd}
		<span class="font-medium">+ {newValue}</span>
	{:else}
		<span class="line-through text-muted-foreground">&minus; {oldValue}</span>
	{/if}
{:else}
	<span>
		<span class="line-through text-muted-foreground">{oldValue ?? ''}</span>
		&rarr;
		<span class="font-medium">{newValue ?? ''}</span>
	</span>
{/if}
