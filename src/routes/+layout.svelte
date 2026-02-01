<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { fetchUser } from '$lib/stores/auth.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import SEO from '$lib/components/SEO.svelte';

	let { children } = $props();

	onMount(() => {
		fetchUser();
	});

	const baseUrl = 'https://floorplanner.orellbuehler.ch';
</script>

<SEO
	title="Floorplanner"
	description="Create and share floor plans for your apartment"
	image="{baseUrl}/og-image.png"
	url={baseUrl}
/>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<Tooltip.Provider>
	<div class="h-screen bg-slate-100 flex flex-col overflow-hidden">
		{@render children()}
	</div>
</Tooltip.Provider>
