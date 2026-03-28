<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { getPendingChanges, isOnline } from '$lib/stores/sync.svelte';
	import * as m from '$lib/paraglide/messages';

	const pending = $derived(getPendingChanges());
	const online = $derived(isOnline());
</script>

{#if !online}
	<Badge variant="outline" class="border-amber-300 bg-amber-50 text-amber-700" title={pending > 0 ? m.offline_pending_changes({ count: pending.toString() }) : m.offline_status()}>
		<span class="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5"></span>
		{m.offline_status()}
		{#if pending > 0}
			({pending})
		{/if}
	</Badge>
{/if}
