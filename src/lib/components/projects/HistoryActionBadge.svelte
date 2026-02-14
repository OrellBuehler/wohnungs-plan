<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	let { action, viaMcp = false }: { action: string; viaMcp?: boolean } = $props();
	const variant = $derived(
		action === 'create' ? 'default' : action === 'delete' ? 'destructive' : 'secondary'
	);
</script>

<span class="inline-flex items-center gap-1">
	<Badge {variant}>{action}</Badge>
	<Badge variant="outline" class="text-[10px] px-1 py-0">{viaMcp ? 'MCP' : 'User'}</Badge>
</span>
