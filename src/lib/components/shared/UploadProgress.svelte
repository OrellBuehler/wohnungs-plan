<script lang="ts">
	interface Props {
		progress: number;
		filename: string;
	}

	let { progress, filename }: Props = $props();

	const displayName = $derived(filename.length > 25 ? filename.slice(0, 22) + '...' : filename);
</script>

<div class="flex flex-col gap-1.5 w-full min-w-[200px]">
	<div class="flex items-center justify-between text-sm">
		<span class="truncate text-foreground">{displayName}</span>
		<span class="text-muted-foreground ml-2 tabular-nums">{progress}%</span>
	</div>
	<div class="h-2 w-full rounded-full bg-muted overflow-hidden">
		<div
			class="h-full rounded-full bg-primary transition-all duration-300"
			style="width: {progress}%"
		></div>
	</div>
</div>
