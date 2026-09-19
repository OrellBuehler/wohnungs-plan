<script lang="ts">
	let { text, muted = false, title }: { text: string; muted?: boolean; title?: string } = $props();
</script>

<span class={muted ? 'text-muted-foreground' : ''} {title}>{text}</span>
