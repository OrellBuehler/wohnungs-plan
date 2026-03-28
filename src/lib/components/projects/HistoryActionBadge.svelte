<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import * as m from '$lib/paraglide/messages';
	let { action, viaMcp = false }: { action: string; viaMcp?: boolean } = $props();
	const variant = $derived(
		action === 'create' ? 'default' : action === 'delete' ? 'destructive' : 'secondary'
	);

	const actionLabel = (a: string) => {
		const map: Record<string, () => string> = {
			create: m.history_action_create,
			update: m.history_action_update,
			delete: m.history_action_delete
		};
		return (map[a] ?? (() => a))();
	};
</script>

<span class="inline-flex items-center gap-1">
	<Badge {variant}>{actionLabel(action)}</Badge>
	<Badge variant="outline" class="text-[10px] px-1 py-0"
		>{viaMcp ? m.history_source_mcp() : m.history_source_user()}</Badge
	>
</span>
