<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import Copy from '@lucide/svelte/icons/copy';
	import Send from '@lucide/svelte/icons/send';

	export type ProjectRole = 'editor' | 'viewer';

	interface Props {
		onInvite: (email: string, role: ProjectRole) => Promise<string | null>;
	}

	let { onInvite }: Props = $props();

	let email = $state('');
	let role = $state<ProjectRole>('editor');
	let inviteLink = $state<string | null>(null);
	let isSubmitting = $state(false);

	const roleOptions = [
		{ value: 'editor', label: () => m.sharing_role_editor() },
		{ value: 'viewer', label: () => m.sharing_role_viewer() }
	] as const;

	async function handleInvite() {
		if (!email) return;
		isSubmitting = true;
		inviteLink = null;
		try {
			const token = await onInvite(email, role);
			if (token) {
				inviteLink = `${window.location.origin}/invite/${token}`;
			}
			email = '';
		} catch {
			toast.error(m.share_invite_send_error());
		} finally {
			isSubmitting = false;
		}
	}

	async function copyInviteLink() {
		if (!inviteLink) return;
		await navigator.clipboard.writeText(inviteLink);
	}
</script>

<div class="space-y-3">
	<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
		<Input
			class="w-full sm:flex-1"
			placeholder={m.sharing_invite_placeholder()}
			value={email}
			oninput={(e) => (email = (e.target as HTMLInputElement).value)}
		/>

		<Select.Root type="single" value={role} onValueChange={(v) => (role = v as ProjectRole)}>
			<Select.Trigger class="h-9 w-full sm:w-auto sm:min-w-[110px]">
				{roleOptions.find((o) => o.value === role)?.label() ?? 'Role'}
			</Select.Trigger>
			<Select.Content>
				{#each roleOptions as option (option.value)}
					<Select.Item value={option.value}>{option.label()}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>

		<Button class="w-full sm:w-auto" onclick={handleInvite} disabled={isSubmitting || !email}>
			<Send class="mr-2 h-4 w-4" />
			{m.common_invite()}
		</Button>
	</div>

	{#if inviteLink}
		<div class="flex items-center gap-2 rounded-lg bg-surface p-2 text-xs overflow-hidden">
			<span class="truncate flex-1 min-w-0">{inviteLink}</span>
			<Button variant="ghost" size="icon-sm" class="flex-shrink-0" onclick={copyInviteLink}>
				<Copy class="h-4 w-4" />
			</Button>
		</div>
	{/if}
</div>
