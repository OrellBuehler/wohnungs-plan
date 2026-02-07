<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { fetchUser, getUser, isAuthenticated } from '$lib/stores/auth.svelte';

	type InviteData = {
		projectId: string;
		projectName: string | null;
		email: string | null;
		role: string;
		expiresAt: string;
	};

	let invite = $state<InviteData | null>(null);
	let isLoading = $state(true);
	let isAccepting = $state(false);
	let isAuthed = $state(false);
	let errorTitle = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);

	const token = $derived($page.params.token);
	const currentUserEmail = $derived(getUser()?.email ?? null);

	onMount(async () => {
		await fetchUser();
		isAuthed = isAuthenticated();
		await loadInvite();
	});

	async function loadInvite() {
		isLoading = true;
		errorTitle = null;
		errorMessage = null;

		try {
			const response = await fetch(`/api/invites/${token}`);
			if (!response.ok) {
				const detail = await response.text();
				setErrorFromStatus(response.status, detail);
				return;
			}

			const data = await response.json();
			invite = data.invite;
		} catch {
			errorTitle = 'Unable to load invite';
			errorMessage = 'Please check your connection and try again.';
		} finally {
			isLoading = false;
		}
	}

	function setErrorFromStatus(status: number, detail: string) {
		invite = null;
		if (status === 404) {
			errorTitle = 'Invite not found';
			errorMessage = 'This invite link is invalid or no longer exists.';
			return;
		}
		if (status === 410) {
			if (detail.includes('expired')) {
				errorTitle = 'Invite expired';
				errorMessage = 'This invite has expired. Ask the project owner to send a new link.';
				return;
			}
			errorTitle = 'Invite already used';
			errorMessage = 'This invite has already been accepted.';
			return;
		}
		if (status === 403) {
			errorTitle = 'Email mismatch';
			errorMessage = 'Sign in with the same email address that received this invite.';
			return;
		}
		if (status === 401) {
			errorTitle = 'Sign in required';
			errorMessage = 'Please sign in to continue.';
			return;
		}
		errorTitle = 'Invite error';
		errorMessage = detail || 'Something went wrong while processing this invite.';
	}

	function signIn() {
		const redirectPath = `/invite/${token}`;
		window.location.href = `/api/auth/login?redirect=${encodeURIComponent(redirectPath)}`;
	}

	async function acceptInvite() {
		isAccepting = true;
		errorTitle = null;
		errorMessage = null;
		try {
			const response = await fetch(`/api/invites/${token}`, { method: 'POST' });
			if (!response.ok) {
				const detail = await response.text();
				setErrorFromStatus(response.status, detail);
				return;
			}

			const data = await response.json();
			await goto(`/projects/${data.projectId}`);
		} catch {
			errorTitle = 'Unable to accept invite';
			errorMessage = 'Please try again.';
		} finally {
			isAccepting = false;
		}
	}
</script>

<div class="h-full overflow-y-auto bg-slate-50 flex items-center justify-center p-4">
	<div class="w-full max-w-md">
		<Card.Root>
			<Card.Header>
				<div class="flex items-center gap-3 mb-2">
					<img src="/icon.svg" alt="Floorplanner" class="size-10" />
					<div>
						<Card.Title class="text-xl">Project Invite</Card.Title>
						<Card.Description>Join a shared Floorplanner project</Card.Description>
					</div>
				</div>
			</Card.Header>

			<Card.Content>
				{#if isLoading}
					<div class="space-y-3">
						<div class="h-5 bg-slate-100 rounded animate-pulse w-2/3"></div>
						<div class="h-4 bg-slate-100 rounded animate-pulse w-full"></div>
						<div class="h-4 bg-slate-100 rounded animate-pulse w-5/6"></div>
					</div>
				{:else if errorTitle}
					<div class="space-y-3">
						<p class="text-sm font-medium text-red-700">{errorTitle}</p>
						<p class="text-sm text-slate-600">{errorMessage}</p>
					</div>
				{:else if invite}
					<div class="space-y-4">
						<div class="space-y-2 text-sm">
							<div class="flex justify-between gap-4">
								<span class="text-slate-500">Project</span>
								<span class="text-slate-800 font-medium text-right">
									{invite.projectName ?? 'Untitled project'}
								</span>
							</div>
							<div class="flex justify-between gap-4">
								<span class="text-slate-500">Role</span>
								<span class="text-slate-800 font-medium capitalize">{invite.role}</span>
							</div>
							<div class="flex justify-between gap-4">
								<span class="text-slate-500">Invited email</span>
								<span class="text-slate-800 font-medium text-right">{invite.email ?? 'Any account'}</span>
							</div>
						</div>

						{#if isAuthed && currentUserEmail}
							<p class="text-xs text-slate-500">
								Signed in as <strong>{currentUserEmail}</strong>
							</p>
						{/if}
					</div>
				{/if}
			</Card.Content>

			<div class="flex gap-3 px-6 pb-6">
				{#if !isLoading}
					{#if !isAuthed}
						<Button class="w-full" onclick={signIn}>
							Sign in to accept
						</Button>
					{:else if invite}
						<Button class="w-full" onclick={acceptInvite} disabled={isAccepting}>
							{isAccepting ? 'Accepting...' : 'Accept invite'}
						</Button>
					{:else}
						<Button variant="outline" class="w-full" onclick={loadInvite}>
							Try again
						</Button>
					{/if}
				{/if}
			</div>
		</Card.Root>
	</div>
</div>
