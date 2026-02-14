<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	let { action }: { action: string } = $props();
	const variant = $derived(
		action === 'create' ? 'default' : action === 'delete' ? 'destructive' : 'secondary'
	);
</script>

<Badge {variant}>{action}</Badge>
