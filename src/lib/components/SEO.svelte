<script lang="ts">
	interface Props {
		title: string;
		description: string;
		image?: string;
		url?: string;
	}

	let { title, description, image, url }: Props = $props();
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />

	<!-- Open Graph -->
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	{#if image}
		<meta property="og:image" content={image} />
	{/if}
	{#if url}
		<meta property="og:url" content={url} />
	{/if}
	<meta property="og:type" content="website" />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	{#if image}
		<meta name="twitter:image" content={image} />
	{/if}
</svelte:head>
