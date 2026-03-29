<script lang="ts">
	import { page } from '$app/stores';
	import { Separator } from '$lib/components/ui/separator';
	import SidebarTrigger from '$lib/components/layout/SidebarTrigger.svelte';
	import { cn } from '$lib/utils';
	import Settings from '@lucide/svelte/icons/settings';
	import Plug from '@lucide/svelte/icons/plug';
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages';

	let { children }: { children: Snippet } = $props();

	const navItems = [
		{ href: '/settings/general', label: m.settings_nav_general(), icon: Settings },
		{ href: '/settings/mcp', label: m.settings_nav_mcp(), icon: Plug }
	];

	function isActive(href: string): boolean {
		return $page.url.pathname.startsWith(href);
	}
</script>

<div class="flex flex-col flex-1 overflow-hidden">
	<!-- Header -->
	<header
		class="min-h-14 bg-surface-container-lowest/80 backdrop-blur-[12px] flex items-center justify-between px-4 py-3 flex-shrink-0"
		style="padding-top: max(0.75rem, env(safe-area-inset-top));"
	>
		<a href="/" class="flex items-center gap-2 md:hidden">
			<img src="/icon.svg" alt="Floorplanner" class="size-8" />
			<h1 class="font-display text-xl font-semibold text-on-surface">{m.settings_title()}</h1>
		</a>
		<h1 class="font-display hidden md:block text-xl font-semibold text-on-surface">
			{m.settings_title()}
		</h1>
		<div class="flex-shrink-0 md:hidden">
			<SidebarTrigger />
		</div>
	</header>

	<!-- Mobile tab nav -->
	<div class="md:hidden flex bg-surface-container-lowest px-2">
		{#each navItems as item}
			<a
				href={item.href}
				class={cn(
					'flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors',
					isActive(item.href)
						? 'border-primary text-primary'
						: 'border-transparent text-on-surface-variant hover:text-on-surface'
				)}
			>
				<item.icon class="size-4" />
				{item.label}
			</a>
		{/each}
	</div>

	<!-- Body -->
	<div class="flex flex-1 overflow-hidden min-h-0">
		<!-- Desktop sidebar -->
		<aside class="hidden md:flex w-60 flex-col bg-surface-container-low p-4 flex-shrink-0">
			<nav class="flex flex-col gap-1">
				{#each navItems as item}
					<a
						href={item.href}
						class={cn(
							'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
							isActive(item.href)
								? 'bg-surface-container text-on-surface'
								: 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
						)}
					>
						<item.icon class="size-4" />
						{item.label}
					</a>
				{/each}
			</nav>
		</aside>

		<!-- Content -->
		<main class="flex-1 overflow-y-auto">
			{@render children()}
		</main>
	</div>
</div>
