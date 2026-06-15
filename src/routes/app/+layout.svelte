<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchUser } from '$lib/stores/auth.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import SEO from '$lib/components/SEO.svelte';
	import AppSidebar from '$lib/components/layout/AppSidebar.svelte';
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

<Tooltip.Provider>
	<div class="bg-surface flex overflow-hidden" style="height: 100dvh;">
		<AppSidebar />
		<div class="flex-1 flex flex-col overflow-hidden min-w-0">
			{@render children()}
		</div>
	</div>
</Tooltip.Provider>
