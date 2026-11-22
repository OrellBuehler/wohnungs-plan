<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { Toaster } from '#lib/components/ui/sonner/index.js';

	let { children } = $props();

	// Reload once an updated service worker takes over, so the page never runs stale code
	onMount(() => {
		if (!('serviceWorker' in navigator)) return;
		const hadController = !!navigator.serviceWorker.controller;
		const onControllerChange = () => {
			if (hadController) location.reload();
		};
		navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
		return () =>
			navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
	});
</script>

<svelte:head>
	<!-- version: {import.meta.env.VITE_APP_VERSION || 'dev'} -->
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/manifest.json" />
	<meta name="theme-color" content="#f7f9fb" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
</svelte:head>

{@render children()}

<Toaster />
