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
	<!-- version: {import.meta.env.VITE_GIT_HASH || 'dev'} | built: {import.meta.env.VITE_BUILD_TIMESTAMP || 'dev'} -->
	<link rel="icon" href="/icon.svg" type="image/svg+xml" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/manifest.json" />
	<meta name="theme-color" content="#4E74FF" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
</svelte:head>

<Tooltip.Provider>
	<div class="h-screen bg-slate-100 flex flex-col overflow-hidden" style="height: 100dvh;">
		{@render children()}
	</div>
</Tooltip.Provider>
