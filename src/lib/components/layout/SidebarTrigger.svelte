<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { LogIn } from 'lucide-svelte';
	import { getUser, isAuthenticated, isLoading, login } from '$lib/stores/auth.svelte';
	import { setSidebarOpen } from '$lib/stores/sidebar.svelte';
	import { getInitials } from '$lib/utils/format';

	const user = $derived(getUser());
	const authed = $derived(isAuthenticated());
	const loading = $derived(isLoading());
</script>

{#if authed}
	<Button
		variant="ghost"
		class="relative h-9 w-9 rounded-full p-0 overflow-hidden shrink-0"
		onclick={() => setSidebarOpen(true)}
	>
		{#if user?.avatarUrl}
			<img
				src={user.avatarUrl}
				alt={user.name ?? 'User avatar'}
				class="absolute inset-0 h-full w-full rounded-full object-cover"
			/>
		{:else}
			<div
				class="flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium"
			>
				{getInitials(user?.name ?? null)}
			</div>
		{/if}
	</Button>
{:else}
	<Button variant="outline" onclick={login} disabled={loading}>
		<LogIn class="mr-2 h-4 w-4" />
		{loading ? 'Loading...' : 'Sign in'}
	</Button>
{/if}
