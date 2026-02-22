<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { fetchUser } from '$lib/stores/auth.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import SEO from '$lib/components/SEO.svelte';
	import AppSidebar from '$lib/components/layout/AppSidebar.svelte';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import * as m from '$lib/paraglide/messages';

	let { children } = $props();

	onMount(() => {
		fetchUser();
	});

	const baseUrl = 'https://floorplanner.orellbuehler.ch';
</script>

<SEO
	title={m.app_title()}
	description={m.app_description()}
	image="{baseUrl}/og-image.png"
	url={baseUrl}
/>

<svelte:head>
	<!-- version: {import.meta.env.VITE_APP_VERSION || 'dev'} -->
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
	<AppSidebar />
</Tooltip.Provider>

<Toaster />
