<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Button } from '$lib/components/ui/button';
	import { LogOut } from 'lucide-svelte';
	import { getUser, logout } from '$lib/stores/auth.svelte';

	const user = $derived(getUser());

	function getInitials(name: string | null): string {
		if (!name) return '?';
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}
</script>

{#if user}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button variant="ghost" class="relative h-9 w-9 rounded-full p-0 overflow-hidden shrink-0" {...props}>
					{#if user.avatarUrl}
						<img
							src={user.avatarUrl}
							alt={user.name ?? 'User avatar'}
							class="absolute inset-0 h-full w-full rounded-full object-cover"
						/>
					{:else}
						<div
							class="flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium"
						>
							{getInitials(user.name)}
						</div>
					{/if}
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" class="w-56">
			<DropdownMenu.Label>
				<div class="flex flex-col space-y-1">
					<p class="text-sm font-medium">{user.name ?? 'User'}</p>
					{#if user.email}
						<p class="text-xs text-muted-foreground">{user.email}</p>
					{/if}
				</div>
			</DropdownMenu.Label>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onclick={logout}>
				<LogOut class="mr-2 h-4 w-4" />
				Sign out
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/if}
