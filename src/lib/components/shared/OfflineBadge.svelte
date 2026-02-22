<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { getPendingChanges, isOnline } from '$lib/stores/sync.svelte';
	import * as m from '$lib/paraglide/messages';

	const pending = $derived(getPendingChanges());
	const online = $derived(isOnline());
	const visible = $derived(!online && pending > 0);
</script>

{#if visible}
	<Badge variant="outline" title={m.offline_pending_changes({ count: pending.toString() })}>
		{m.offline_status()} ({pending})
	</Badge>
{/if}
