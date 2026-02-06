<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import type { PageData } from './$types';

	export let data: PageData;

	let accepting = false;
	let error = '';

	onMount(async () => {
		// If autoAccept flag is set and user is logged in, automatically accept the invite
		if (data.autoAccept && data.user) {
			await acceptInvite();
		}
	});

	async function acceptInvite() {
		if (accepting) return;

		accepting = true;
		error = '';

		try {
			const response = await fetch(`/api/invites/${data.invite.token}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				const result = await response.json().catch(() => ({}));
				throw new Error(result.message || 'Failed to accept invite');
			}

			const result = await response.json();

			// Redirect to the project
			await goto(`/projects/${result.projectId}`);
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
			accepting = false;
		}
	}

	function handleLogin() {
		// Redirect to login with return URL to come back to this invite page with autoAccept flag
		const returnUrl = encodeURIComponent(`/invites/${data.invite.token}?autoAccept=true`);
		window.location.href = `/api/auth/login?returnUrl=${returnUrl}`;
	}
</script>

<div class="container mx-auto flex min-h-[80vh] items-center justify-center px-4">
	<Card class="w-full max-w-md">
		<CardHeader>
			<CardTitle>You've been invited!</CardTitle>
			<CardDescription>
				You've been invited to collaborate on a project
			</CardDescription>
		</CardHeader>
		<CardContent class="space-y-4">
			<div class="space-y-2">
				<div class="text-sm text-muted-foreground">Project</div>
				<div class="font-semibold">{data.invite.projectName}</div>
			</div>

			<div class="space-y-2">
				<div class="text-sm text-muted-foreground">Role</div>
				<div class="capitalize">{data.invite.role}</div>
			</div>

			{#if data.invite.email}
				<div class="space-y-2">
					<div class="text-sm text-muted-foreground">Invited as</div>
					<div>{data.invite.email}</div>
				</div>
			{/if}

			{#if error}
				<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					{error}
				</div>
			{/if}

			<div class="pt-4">
				{#if data.user}
					{#if data.invite.email && data.user.email && data.invite.email.toLowerCase() !== data.user.email.toLowerCase()}
						<div class="space-y-3">
							<div class="rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm">
								This invite was sent to <strong>{data.invite.email}</strong>, but you're
								logged in as <strong>{data.user.email}</strong>.
							</div>
							<Button on:click={acceptInvite} disabled={accepting} class="w-full">
								{accepting ? 'Accepting...' : 'Accept Anyway'}
							</Button>
						</div>
					{:else}
						<Button on:click={acceptInvite} disabled={accepting} class="w-full">
							{accepting ? 'Accepting...' : 'Accept Invite'}
						</Button>
					{/if}
				{:else}
					<div class="space-y-3">
						<p class="text-sm text-muted-foreground">
							Sign in to accept this invitation and access the shared project.
						</p>
						<Button on:click={handleLogin} class="w-full">Sign In to Accept</Button>
					</div>
				{/if}
			</div>
		</CardContent>
	</Card>
</div>
