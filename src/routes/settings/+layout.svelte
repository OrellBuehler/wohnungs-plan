<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Separator } from '$lib/components/ui/separator';
	import UserMenu from '$lib/components/auth/UserMenu.svelte';
	import LoginButton from '$lib/components/auth/LoginButton.svelte';
	import { isAuthenticated, fetchUser } from '$lib/stores/auth.svelte';
	import { onMount } from 'svelte';
	import { cn } from '$lib/utils';
	import Menu from 'lucide-svelte/icons/menu';
	import Settings from 'lucide-svelte/icons/settings';
	import Plug from 'lucide-svelte/icons/plug';
	import ArrowLeft from 'lucide-svelte/icons/arrow-left';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const authenticated = $derived(isAuthenticated());
	let sheetOpen = $state(false);

	onMount(() => {
		fetchUser();
	});

	// Auto-close sheet on route change
	$effect(() => {
		$page.url.pathname;
		sheetOpen = false;
	});

	const navItems = [
		{ href: '/settings/general', label: 'General', icon: Settings },
		{ href: '/settings/mcp', label: 'MCP Integration', icon: Plug }
	];

	function isActive(href: string): boolean {
		return $page.url.pathname.startsWith(href);
	}
</script>

{#snippet navLinks()}
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
	<Separator class="my-2" />
	<a
		href="/"
		class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
	>
		<ArrowLeft class="size-4" />
		Back to Projects
	</a>
{/snippet}

<div class="h-screen bg-slate-50 flex flex-col overflow-hidden">
	<!-- Header -->
	<header
		class="min-h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 py-3 flex-shrink-0"
		style="padding-top: max(0.75rem, env(safe-area-inset-top));"
	>
		<div class="flex items-center gap-2">
			<!-- Hamburger (mobile only) -->
			<Button
				variant="ghost"
				size="icon"
				class="md:hidden -ml-2"
				onclick={() => (sheetOpen = true)}
			>
				<Menu class="size-5" />
				<span class="sr-only">Open menu</span>
			</Button>
			<a href="/" class="flex items-center gap-2">
				<img src="/icon.svg" alt="Floorplanner" class="size-8" />
				<h1 class="text-xl font-semibold text-slate-800">Settings</h1>
			</a>
		</div>
		<div class="flex-shrink-0">
			{#if authenticated}
				<UserMenu />
			{:else}
				<LoginButton />
			{/if}
		</div>
	</header>

	<!-- Body -->
	<div class="flex flex-1 overflow-hidden min-h-0">
		<!-- Desktop sidebar -->
		<aside class="hidden md:flex w-60 flex-col border-r border-slate-200 bg-white p-4 flex-shrink-0">
			{@render navLinks()}
		</aside>

		<!-- Content -->
		<main class="flex-1 overflow-y-auto">
			{@render children()}
		</main>
	</div>
</div>

<!-- Mobile sidebar sheet -->
<Sheet.Root bind:open={sheetOpen}>
	<Sheet.Content side="left" class="w-72 p-4">
		<Sheet.Header class="text-left">
			<Sheet.Title>Settings</Sheet.Title>
			<Sheet.Description class="sr-only">Settings navigation</Sheet.Description>
		</Sheet.Header>
		<div class="mt-4">
			{@render navLinks()}
		</div>
	</Sheet.Content>
</Sheet.Root>
