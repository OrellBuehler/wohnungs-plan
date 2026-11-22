<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as m from '#lib/paraglide/messages.js';

	const notFound = $derived(page.status === 404);
	const title = $derived(notFound ? m.error_not_found_title() : m.error_generic_title());
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<main
	class="min-h-dvh flex items-center justify-center bg-surface px-8 py-16"
	style="background-image: radial-gradient(circle, var(--color-surface-container-highest) 1px, transparent 1px); background-size: 24px 24px;"
>
	<div class="w-full max-w-md rounded-lg bg-surface-container-lowest p-8 text-center">
		<p class="font-technical text-sm tracking-widest text-on-surface-variant">{page.status}</p>
		<h1 class="font-display mt-2 text-2xl font-semibold text-on-surface">{title}</h1>
		<p class="mt-2 text-sm text-on-surface-variant">
			{notFound ? m.error_not_found_description() : m.error_generic_description()}
		</p>
		<Button href="/app" class="mt-6">{m.error_back_to_projects()}</Button>
	</div>
</main>
