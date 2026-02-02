<script lang="ts">
	import '../app.css';
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
	<link rel="icon" href="/icon.svg" type="image/svg+xml" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/manifest.json" />
	<meta name="theme-color" content="#4E74FF" />
</svelte:head>

<Tooltip.Provider>
	<div class="h-screen bg-slate-100 flex flex-col overflow-hidden">
		{@render children()}
	</div>
</Tooltip.Provider>
