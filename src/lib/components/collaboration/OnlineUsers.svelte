<script lang="ts">
	import { getRemoteUsers, getCollaborationState } from '$lib/stores/collaboration.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import * as m from '$lib/paraglide/messages';
	import { getInitials } from '$lib/utils/format';

	const MAX_VISIBLE = 4;

	const users = $derived(getRemoteUsers());
	const { isConnected } = $derived(getCollaborationState());

	const visibleUsers = $derived(users.slice(0, MAX_VISIBLE));
	const overflowCount = $derived(Math.max(0, users.length - MAX_VISIBLE));

	let failedAvatars = $state(new Set<string>());
</script>

{#if isConnected && users.length > 0}
	<div class="flex items-center -space-x-2">
		{#each visibleUsers as user (user.id)}
			<Tooltip.Root>
				<Tooltip.Trigger>
					<div
						class="h-8 w-8 rounded-full border-2 border-background flex items-center justify-center text-xs font-medium text-white"
						style:background-color={user.color}
					>
						{#if user.avatarUrl && !failedAvatars.has(user.id)}
							<img
								src={user.avatarUrl}
								alt={user.name ?? m.online_users_fallback()}
								class="h-full w-full rounded-full object-cover"
								onerror={() => (failedAvatars = new Set([...failedAvatars, user.id]))}
							/>
						{:else}
							{getInitials(user.name)}
						{/if}
					</div>
				</Tooltip.Trigger>
				<Tooltip.Content>
					{user.name ?? m.online_users_anonymous()}
				</Tooltip.Content>
			</Tooltip.Root>
		{/each}

		{#if overflowCount > 0}
			<div
				class="h-8 w-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium"
			>
				+{overflowCount}
			</div>
		{/if}
	</div>
{/if}
