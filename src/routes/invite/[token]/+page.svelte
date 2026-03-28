<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { fetchUser, getUser, isAuthenticated } from '$lib/stores/auth.svelte';
	import * as m from '$lib/paraglide/messages';

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
			errorTitle = m.invite_error_load_title();
			errorMessage = m.invite_error_load_message();
		} finally {
			isLoading = false;
		}
	}

	function setErrorFromStatus(status: number, detail: string) {
		invite = null;
		if (status === 404) {
			errorTitle = m.invite_error_not_found_title();
			errorMessage = m.invite_error_not_found_message();
			return;
		}
		if (status === 410) {
			if (detail.includes('expired')) {
				errorTitle = m.invite_error_expired_title();
				errorMessage = m.invite_error_expired_message();
				return;
			}
			errorTitle = m.invite_error_used_title();
			errorMessage = m.invite_error_used_message();
			return;
		}
		if (status === 403) {
			errorTitle = m.invite_error_email_mismatch_title();
			errorMessage = m.invite_error_email_mismatch_message();
			return;
		}
		if (status === 401) {
			errorTitle = m.invite_error_signin_required_title();
			errorMessage = m.invite_error_signin_required_message();
			return;
		}
		errorTitle = m.invite_error_generic_title();
		errorMessage = detail || m.invite_error_generic_message();
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
			errorTitle = m.invite_error_accept_title();
			errorMessage = m.invite_error_accept_message();
		} finally {
			isAccepting = false;
		}
	}
</script>

<div class="h-full overflow-y-auto bg-surface flex items-center justify-center p-4">
	<div class="w-full max-w-md">
		<Card.Root>
			<Card.Header>
				<div class="flex items-center gap-3 mb-2">
					<img src="/icon.svg" alt="Floorplanner" class="size-10" />
					<div>
						<Card.Title class="text-xl">{m.invite_page_title()}</Card.Title>
						<Card.Description>{m.invite_page_description()}</Card.Description>
					</div>
				</div>
			</Card.Header>

			<Card.Content>
				{#if isLoading}
					<div class="space-y-3">
						<div class="h-5 bg-surface-container-low rounded animate-pulse w-2/3"></div>
						<div class="h-4 bg-surface-container-low rounded animate-pulse w-full"></div>
						<div class="h-4 bg-surface-container-low rounded animate-pulse w-5/6"></div>
					</div>
				{:else if errorTitle}
					<div class="space-y-3">
						<p class="text-sm font-medium text-red-700">{errorTitle}</p>
						<p class="text-sm text-on-surface-variant">{errorMessage}</p>
					</div>
				{:else if invite}
					<div class="space-y-4">
						<div class="space-y-2 text-sm">
							<div class="flex justify-between gap-4">
								<span class="text-on-surface-variant">{m.invite_details_project()}</span>
								<span class="text-on-surface font-medium text-right">
									{invite.projectName ?? m.invite_details_untitled()}
								</span>
							</div>
							<div class="flex justify-between gap-4">
								<span class="text-on-surface-variant">{m.invite_details_role()}</span>
								<span class="text-on-surface font-medium capitalize">{invite.role}</span>
							</div>
							<div class="flex justify-between gap-4">
								<span class="text-on-surface-variant">{m.invite_details_email()}</span>
								<span class="text-on-surface font-medium text-right"
									>{invite.email ?? m.invite_details_any_account()}</span
								>
							</div>
						</div>

						{#if isAuthed && currentUserEmail}
							<p class="text-xs text-on-surface-variant">
								{m.invite_signed_in_as()} <strong>{currentUserEmail}</strong>
							</p>
						{/if}
					</div>
				{/if}
			</Card.Content>

			<div class="flex gap-3 px-6 pb-6">
				{#if !isLoading}
					{#if !isAuthed}
						<Button class="w-full" onclick={signIn}>
							{m.invite_button_signin()}
						</Button>
					{:else if invite}
						<Button class="w-full" onclick={acceptInvite} disabled={isAccepting}>
							{isAccepting ? m.invite_button_accepting() : m.invite_button_accept()}
						</Button>
					{:else}
						<Button variant="outline" class="w-full" onclick={loadInvite}>
							{m.invite_button_retry()}
						</Button>
					{/if}
				{/if}
			</div>
		</Card.Root>
	</div>
</div>
