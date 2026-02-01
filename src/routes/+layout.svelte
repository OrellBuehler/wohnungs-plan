<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { fetchUser } from '$lib/stores/auth.svelte';

	let { children } = $props();

	onMount(() => {
		fetchUser();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="h-screen bg-slate-100 flex flex-col overflow-hidden">
	{@render children()}
</div>
