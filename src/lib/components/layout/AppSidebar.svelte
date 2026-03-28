<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import LogOut from '@lucide/svelte/icons/log-out';
	import LogIn from '@lucide/svelte/icons/log-in';
	import Home from '@lucide/svelte/icons/home';
	import Settings from '@lucide/svelte/icons/settings';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { page } from '$app/stores';
	import { getUser, isAuthenticated, isLoading, login, logout } from '$lib/stores/auth.svelte';
	import {
		isSidebarOpen,
		setSidebarOpen,
		getProjectContext,
		type ProjectAction
	} from '$lib/stores/sidebar.svelte';
	import { getInitials } from '$lib/utils/format';
	import * as m from '$lib/paraglide/messages';
	import LanguageSwitcher from './LanguageSwitcher.svelte';

	const user = $derived(getUser());
	const authed = $derived(isAuthenticated());
	const loading = $derived(isLoading());
	const open = $derived(isSidebarOpen());
	const projectContext = $derived(getProjectContext());

	function handleOpenChange(value: boolean) {
		setSidebarOpen(value);
	}

	// Auto-close on route navigation
	let lastPath = $state('');
	$effect(() => {
		const currentPath = $page.url.pathname;
		if (lastPath && lastPath !== currentPath) {
			setSidebarOpen(false);
		}
		lastPath = currentPath;
	});

	function handleAction(action: ProjectAction) {
		setSidebarOpen(false);
		// Brief delay to let Sheet close animation start
		setTimeout(() => action.onclick(), 150);
	}

	function handleBranchSelect(event: Event) {
		const target = event.currentTarget as HTMLSelectElement | null;
		const branchId = target?.value;
		if (!branchId || !projectContext?.branch) return;
		if (branchId === projectContext.branch.activeBranchId) return;
		projectContext.branch.onSelect(branchId);
	}

	function handleSignOut() {
		setSidebarOpen(false);
		logout();
	}

	let avatarError = $state(false);

	const navItems = $derived([
		{ href: '/', label: m.nav_projects(), icon: Home },
		{ href: '/settings', label: m.nav_settings(), icon: Settings }
	]);

	function isNavActive(href: string): boolean {
		if (href === '/') return $page.url.pathname === '/';
		return $page.url.pathname.startsWith(href);
	}
</script>

{#snippet sidebarBody(onAction: (action: ProjectAction) => void)}
	<div class="flex-1 overflow-y-auto">
		<!-- User info -->
		{#if authed && user}
			<div class="flex items-center gap-3 px-4 py-4">
				{#if user.avatarUrl && !avatarError}
					<img
						src={user.avatarUrl}
						alt={user.name ?? m.nav_user_fallback()}
						class="h-9 w-9 rounded-xl object-cover shrink-0"
						onerror={() => (avatarError = true)}
					/>
				{:else}
					<div
						class="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container-high text-sm font-medium shrink-0"
					>
						{getInitials(user.name)}
					</div>
				{/if}
				<div class="min-w-0">
					<p class="text-sm font-medium truncate text-on-surface">{user.name ?? m.nav_user_fallback()}</p>
					{#if user.email}
						<p class="text-xs text-on-surface-variant truncate">{user.email}</p>
					{/if}
				</div>
			</div>
		{:else if !authed}
			<div class="px-4 py-4">
				<Button variant="outline" class="w-full" onclick={login} disabled={loading}>
					<LogIn class="mr-2 h-4 w-4" />
					{loading ? m.common_loading() : m.common_sign_in()}
				</Button>
			</div>
		{/if}

		<Separator />

		<!-- Navigation -->
		<nav class="px-2 py-2">
			{#each navItems as item}
				<a
					href={item.href}
					class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors {isNavActive(
						item.href
					)
						? 'bg-surface-container text-on-surface'
						: 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}"
				>
					<item.icon class="size-4 shrink-0" />
					{item.label}
				</a>
			{/each}
		</nav>

		<!-- Project context groups -->
		{#if projectContext}
			<!-- Branch section -->
			{#if projectContext.branch}
				<Separator />
				<div class="px-4 py-3">
					<p class="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
						{m.branch_title()}
					</p>
					<select
						class="w-full h-9 rounded-lg border border-outline-variant/30 bg-surface-container px-2 text-sm text-on-surface"
						value={projectContext.branch.activeBranchId ?? ''}
						disabled={projectContext.branch.isSwitching}
						onchange={handleBranchSelect}
					>
						{#each projectContext.branch.branches as branch}
							<option value={branch.id}>{branch.name}</option>
						{/each}
					</select>
					<div class="flex gap-1.5 mt-2">
						<Button
							variant="outline"
							size="sm"
							class="flex-1 text-xs"
							onclick={() => {
								setSidebarOpen(false);
								projectContext?.branch?.onCreate();
							}}
							disabled={projectContext.branch.isSwitching}
						>
							{m.branch_new()}
						</Button>
						<Button
							variant="outline"
							size="sm"
							class="flex-1 text-xs"
							onclick={() => {
								setSidebarOpen(false);
								projectContext?.branch?.onRename();
							}}
							disabled={!projectContext.branch.activeBranchId ||
								projectContext.branch.isSwitching}
						>
							{m.branch_rename()}
						</Button>
						<Button
							variant="outline"
							size="sm"
							class="flex-1 text-xs"
							onclick={() => {
								setSidebarOpen(false);
								projectContext?.branch?.onDelete();
							}}
							disabled={!projectContext.branch.canDelete || projectContext.branch.isSwitching}
						>
							{m.branch_delete()}
						</Button>
					</div>
				</div>
			{/if}

			<!-- Action groups -->
			{#each projectContext.actionGroups as group}
				<Separator />
				<div class="px-2 py-2">
					<p
						class="text-xs font-semibold text-on-surface-variant uppercase tracking-wider px-3 mb-1"
					>
						{group.title}
					</p>
					{#each group.actions as action}
						<button
							type="button"
							class="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-container text-on-surface-variant hover:text-on-surface disabled:opacity-50 disabled:pointer-events-none"
							onclick={() => onAction(action)}
							disabled={action.disabled}
						>
							{#if action.icon}
								{@const Icon = action.icon}
								<Icon class="size-4 shrink-0" />
							{/if}
							<span class="flex-1 text-left">{action.label}</span>
							{#if action.indicator}
								<span class="text-xs text-on-surface-variant">{action.indicator}</span>
							{:else}
								<ChevronRight class="size-3.5 text-on-surface-variant" />
							{/if}
						</button>
					{/each}
				</div>
			{/each}
		{/if}
	</div>

	<!-- Language + Sign out at bottom -->
	<div class="mt-auto">
		<div class="border-t border-outline-variant/15 px-4 py-3">
			<LanguageSwitcher />
		</div>
		{#if authed}
			<div class="border-t border-outline-variant/15 px-2 py-2">
				<button
					type="button"
					class="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-container text-on-surface-variant hover:text-on-surface"
					onclick={handleSignOut}
				>
					<LogOut class="size-4 shrink-0" />
					{m.common_sign_out()}
				</button>
			</div>
		{/if}
	</div>
{/snippet}

<!-- Desktop persistent sidebar -->
<aside class="hidden md:flex flex-col w-64 shrink-0 bg-surface-container-low" style="height: 100dvh;">
	<!-- App title -->
	<div class="flex items-center px-5 h-16 shrink-0">
		<span class="font-display text-lg font-extrabold text-on-surface tracking-tight">Wohnungs-Plan</span>
	</div>
	{@render sidebarBody(handleAction)}
</aside>

<!-- Mobile sheet -->
<Sheet.Root {open} onOpenChange={handleOpenChange}>
	<Sheet.Content
		side="right"
		class="!w-full sm:!w-80 sm:!max-w-sm flex flex-col bg-surface-container-low p-0"
	>
		<Sheet.Header class="p-4 pb-0">
			<Sheet.Title class="sr-only">{m.nav_menu_title()}</Sheet.Title>
			<Sheet.Description class="sr-only">{m.nav_menu_description()}</Sheet.Description>
		</Sheet.Header>
		{@render sidebarBody((action) => handleAction(action))}
	</Sheet.Content>
</Sheet.Root>
