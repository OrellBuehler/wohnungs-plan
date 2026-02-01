<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import { Copy, Send } from 'lucide-svelte';

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
		{ value: 'editor', label: 'Editor' },
		{ value: 'viewer', label: 'Viewer' }
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
		} catch (err) {
			console.error('Invite failed:', err);
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
			placeholder="Invite by email"
			value={email}
			oninput={(e) => (email = (e.target as HTMLInputElement).value)}
		/>

		<Select.Root
			type="single"
			value={role}
			onValueChange={(v) => (role = v as ProjectRole)}
		>
			<Select.Trigger class="h-9 min-w-[110px]">
				{roleOptions.find((o) => o.value === role)?.label ?? 'Role'}
			</Select.Trigger>
			<Select.Content>
				{#each roleOptions as option (option.value)}
					<Select.Item value={option.value}>{option.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>

		<Button onclick={handleInvite} disabled={isSubmitting || !email}>
			<Send class="mr-2 h-4 w-4" />
			Invite
		</Button>
	</div>

	{#if inviteLink}
		<div class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
			<span class="truncate">{inviteLink}</span>
			<Button variant="ghost" size="icon-sm" onclick={copyInviteLink}>
				<Copy class="h-4 w-4" />
			</Button>
		</div>
	{/if}
</div>
