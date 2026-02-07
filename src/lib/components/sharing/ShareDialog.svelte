<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { getUser } from '$lib/stores/auth.svelte';
	import MemberList, { type Member, type ProjectRole } from './MemberList.svelte';
	import InviteForm from './InviteForm.svelte';

	interface Props {
		open: boolean;
		projectId: string;
		onClose: () => void;
	}

	let { open = $bindable(), projectId, onClose }: Props = $props();

	const user = $derived(getUser());

	let members = $state<Member[]>([]);
	let isLoading = $state(false);
	let errorMessage = $state<string | null>(null);
	let removeConfirmOpen = $state(false);
	let memberToRemove = $state<Member | null>(null);
	let isRemovingMember = $state(false);

	const currentUserId = $derived(user?.id ?? null);
	const currentUserRole = $derived.by(() => {
		const member = members.find((m) => m.userId === currentUserId);
		return member?.role ?? null;
	});
	const canManage = $derived(currentUserRole === 'owner');

	$effect(() => {
		if (open && projectId) {
			loadMembers();
		}
	});

	function handleClose() {
		removeConfirmOpen = false;
		memberToRemove = null;
		open = false;
		onClose();
	}

	async function loadMembers() {
		isLoading = true;
		errorMessage = null;
		try {
			const response = await fetch(`/api/projects/${projectId}/members`);
			if (!response.ok) throw new Error('Failed to load members');
			const data = await response.json();
			members = data.members ?? [];
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to load members';
		} finally {
			isLoading = false;
		}
	}

	async function handleInvite(email: string, role: ProjectRole): Promise<string | null> {
		const response = await fetch(`/api/projects/${projectId}/members`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, role })
		});
		if (!response.ok) {
			throw new Error('Invite failed');
		}
		const data = await response.json();
		if (data.member) {
			await loadMembers();
			return null;
		}
		return data.invite?.token ?? null;
	}

	async function handleRoleChange(userId: string, role: ProjectRole) {
		const response = await fetch(`/api/projects/${projectId}/members/${userId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ role })
		});
		if (response.ok) {
			await loadMembers();
		}
	}

	function handleRemove(userId: string) {
		const member = members.find((candidate) => candidate.userId === userId);
		if (!member) return;
		memberToRemove = member;
		removeConfirmOpen = true;
	}

	function closeRemoveConfirm() {
		if (isRemovingMember) return;
		removeConfirmOpen = false;
		memberToRemove = null;
	}

	async function confirmRemoveMember() {
		if (!memberToRemove || isRemovingMember) return;
		isRemovingMember = true;
		try {
			const response = await fetch(`/api/projects/${projectId}/members/${memberToRemove.userId}`, {
				method: 'DELETE'
			});
			if (response.ok) {
				await loadMembers();
			}
			removeConfirmOpen = false;
			memberToRemove = null;
		} finally {
			isRemovingMember = false;
		}
	}
</script>

<Dialog.Root bind:open onOpenChange={(o) => !o && handleClose()}>
	<Dialog.Content class="max-w-[calc(100vw-2rem)] sm:max-w-xl">
		<Dialog.Header>
			<Dialog.Title>Share Project</Dialog.Title>
			<Dialog.Description>
				Invite people to collaborate. Owners can manage roles and remove members.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-6">
			{#if canManage}
				<InviteForm onInvite={handleInvite} />
			{/if}

			{#if isLoading}
				<p class="text-sm text-muted-foreground">Loading members…</p>
			{:else if errorMessage}
				<p class="text-sm text-red-600">{errorMessage}</p>
			{:else}
				<MemberList
					members={members}
					currentUserId={currentUserId}
					canManage={canManage}
					onRoleChange={handleRoleChange}
					onRemove={handleRemove}
				/>
			{/if}
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={handleClose}>Close</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={removeConfirmOpen} onOpenChange={(open) => !open && closeRemoveConfirm()}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Remove Member</Dialog.Title>
			<Dialog.Description class="break-words">
				Remove
				<strong>
					{memberToRemove?.name ?? memberToRemove?.email ?? 'this member'}
				</strong>
				from this project?
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="gap-2">
			<Button variant="outline" class="w-full sm:w-auto" onclick={closeRemoveConfirm}>Cancel</Button>
			<Button
				variant="destructive"
				class="w-full sm:w-auto"
				onclick={confirmRemoveMember}
				disabled={isRemovingMember}
			>
				Remove
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
