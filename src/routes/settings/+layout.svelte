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

<div class="h-screen bg-slate-50 flex flex-col overflow-hidden">
	<!-- Header -->
	<header
		class="min-h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 py-3 flex-shrink-0"
		style="padding-top: max(0.75rem, env(safe-area-inset-top));"
	>
		<a href="/" class="flex items-center gap-2">
			<img src="/icon.svg" alt="Floorplanner" class="size-8" />
			<h1 class="text-xl font-semibold text-slate-800">{m.settings_title()}</h1>
		</a>
		<div class="flex-shrink-0">
			<SidebarTrigger />
		</div>
	</header>

	<!-- Mobile tab nav -->
	<div class="md:hidden flex border-b border-slate-200 bg-white px-2">
		{#each navItems as item}
			<a
				href={item.href}
				class={cn(
					'flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors',
					isActive(item.href)
						? 'border-primary text-primary'
						: 'border-transparent text-slate-500 hover:text-slate-700'
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
		<aside
			class="hidden md:flex w-60 flex-col border-r border-slate-200 bg-white p-4 flex-shrink-0"
		>
			<nav class="flex flex-col gap-1">
				{#each navItems as item}
					<a
						href={item.href}
						class={cn(
							'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
							isActive(item.href)
								? 'bg-slate-100 text-slate-900'
								: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
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
