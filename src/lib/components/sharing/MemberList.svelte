<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import UserMinus from '@lucide/svelte/icons/user-minus';
	import Users from '@lucide/svelte/icons/users';
	import { getInitials } from '$lib/utils/format';

	export type ProjectRole = 'owner' | 'editor' | 'viewer';

	export interface Member {
		userId: string;
		name: string | null;
		email: string | null;
		avatarUrl: string | null;
		role: ProjectRole;
	}

	interface Props {
		members: Member[];
		currentUserId: string | null;
		canManage: boolean;
		onRoleChange: (userId: string, role: ProjectRole) => void;
		onRemove: (userId: string) => void;
	}

	let { members, currentUserId, canManage, onRoleChange, onRemove }: Props = $props();

	let failedAvatars = $state(new Set<string>());

	const roleOptions: { value: ProjectRole; label: () => string }[] = [
		{ value: 'owner', label: () => m.sharing_role_owner() },
		{ value: 'editor', label: () => m.sharing_role_editor() },
		{ value: 'viewer', label: () => m.sharing_role_viewer() }
	];
</script>

<div class="space-y-4">
	{#if members.length === 0}
		<div class="flex flex-col items-center justify-center py-8 text-center">
			<Users class="size-8 text-slate-300 mb-2" />
			<p class="text-sm text-muted-foreground">{m.sharing_members_empty()}</p>
		</div>
	{:else}
		{#each members as member (member.userId)}
			<div
				class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-slate-200 p-3"
			>
				<div class="flex items-center gap-3 min-w-0 flex-1">
					<div
						class="h-8 w-8 flex-shrink-0 rounded-full bg-muted flex items-center justify-center text-xs font-medium"
					>
						{#if member.avatarUrl && !failedAvatars.has(member.userId)}
							<img
								src={member.avatarUrl}
								alt={member.name ?? 'Member'}
								class="h-full w-full rounded-full object-cover"
								onerror={() => (failedAvatars = new Set([...failedAvatars, member.userId]))}
							/>
						{:else}
							{getInitials(member.name)}
						{/if}
					</div>
					<div class="min-w-0 flex-1">
						<p class="text-sm font-medium truncate">
							{member.name ?? member.email ?? 'Member'}
							{#if currentUserId && member.userId === currentUserId}
								<span class="text-xs text-muted-foreground">{m.sharing_member_you()}</span>
							{/if}
						</p>
						{#if member.email}
							<p class="text-xs text-muted-foreground truncate">{member.email}</p>
						{/if}
					</div>
				</div>

				<div class="flex items-center gap-2 flex-shrink-0">
					{#if canManage}
						<Select.Root
							type="single"
							value={member.role}
							onValueChange={(v) => onRoleChange(member.userId, v as ProjectRole)}
						>
							<Select.Trigger class="h-8 w-full sm:w-auto sm:min-w-[100px]">
								{roleOptions.find((o) => o.value === member.role)?.label() ?? 'Role'}
							</Select.Trigger>
							<Select.Content>
								{#each roleOptions as option (option.value)}
									<Select.Item value={option.value}>{option.label()}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					{:else}
						<span class="text-xs text-muted-foreground"
							>{roleOptions.find((o) => o.value === member.role)?.label() ?? member.role}</span
						>
					{/if}

					{#if canManage && member.role !== 'owner'}
						<Button
							variant="ghost"
							size="icon-sm"
							class="text-red-600 hover:text-red-700 flex-shrink-0"
							onclick={() => onRemove(member.userId)}
						>
							<UserMinus class="h-4 w-4" />
						</Button>
					{/if}
				</div>
			</div>
		{/each}
	{/if}
</div>
