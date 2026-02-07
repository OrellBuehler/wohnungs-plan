<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import { Copy, Check, Lock, Trash2 } from 'lucide-svelte';

	interface Props {
		projectId: string;
	}

	type ShareLink = {
		id: string;
		token: string;
		label: string | null;
		expiresAt: string | null;
		createdAt: string | null;
		hasPassword: boolean;
	};

	let { projectId }: Props = $props();

	let links = $state<ShareLink[]>([]);
	let isLoading = $state(false);
	let isCreating = $state(false);
	let createError = $state<string | null>(null);
	let loadError = $state<string | null>(null);
	let label = $state('');
	let password = $state('');
	let expiresAt = $state('');
	let showNoPasswordWarning = $state(false);
	let createdShareUrl = $state<string | null>(null);
	let copiedId = $state<string | null>(null);
	let isRevokingId = $state<string | null>(null);

	function getShareUrl(token: string): string {
		return `${window.location.origin}/share/${token}`;
	}

	function formatDate(value: string | null): string {
		if (!value) return 'Never';
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return 'Invalid date';
		return parsed.toLocaleString();
	}

	async function loadLinks() {
		if (!projectId) return;
		isLoading = true;
		loadError = null;
		try {
			const response = await fetch(`/api/projects/${projectId}/share-links`);
			if (!response.ok) {
				throw new Error('Failed to load share links');
			}
			const payload = (await response.json()) as { links: ShareLink[] };
			links = payload.links ?? [];
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Failed to load share links';
		} finally {
			isLoading = false;
		}
	}

	async function copyLink(token: string, id: string) {
		await navigator.clipboard.writeText(getShareUrl(token));
		copiedId = id;
		setTimeout(() => {
			if (copiedId === id) copiedId = null;
		}, 1200);
	}

	async function copyCreatedLink() {
		if (!createdShareUrl) return;
		await navigator.clipboard.writeText(createdShareUrl);
		copiedId = 'created';
		setTimeout(() => {
			if (copiedId === 'created') copiedId = null;
		}, 1200);
	}

	async function createLink(forceWithoutPassword = false) {
		if (!projectId || isCreating) return;

		if (!password.trim() && !forceWithoutPassword) {
			showNoPasswordWarning = true;
			return;
		}

		isCreating = true;
		createError = null;
		try {
			const response = await fetch(`/api/projects/${projectId}/share-links`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					label: label.trim() || undefined,
					password: password.trim() || undefined,
					expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined
				})
			});

			if (!response.ok) {
				throw new Error('Failed to create share link');
			}

			const payload = (await response.json()) as { link: ShareLink };
			createdShareUrl = getShareUrl(payload.link.token);
			label = '';
			password = '';
			expiresAt = '';
			showNoPasswordWarning = false;
			await loadLinks();
		} catch (err) {
			createError = err instanceof Error ? err.message : 'Failed to create share link';
		} finally {
			isCreating = false;
		}
	}

	async function revokeLink(link: ShareLink) {
		if (isRevokingId) return;
		isRevokingId = link.id;
		try {
			const response = await fetch(`/api/projects/${projectId}/share-links/${link.id}`, {
				method: 'DELETE'
			});
			if (!response.ok) {
				throw new Error('Failed to revoke share link');
			}
			links = links.filter((candidate) => candidate.id !== link.id);
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Failed to revoke share link';
		} finally {
			isRevokingId = null;
		}
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		void createLink(false);
	}

	onMount(() => {
		void loadLinks();
	});
</script>

<section class="space-y-4">
	<div>
		<h3 class="text-sm font-semibold text-slate-900">Public share links</h3>
		<p class="text-xs text-slate-500">Create read-only links for anonymous viewers.</p>
	</div>

	<form class="space-y-3 rounded-lg border border-slate-200 p-3" onsubmit={handleSubmit}>
		<div class="space-y-1.5">
			<Label for="share-link-label">Label (optional)</Label>
			<Input id="share-link-label" bind:value={label} placeholder="e.g. Agent viewing link" />
		</div>

		<div class="space-y-1.5">
			<Label for="share-link-password">Password (optional)</Label>
			<Input id="share-link-password" type="password" bind:value={password} placeholder="Protect with password" />
		</div>

		<div class="space-y-1.5">
			<Label for="share-link-expiry">Expires at (optional)</Label>
			<Input id="share-link-expiry" type="date" bind:value={expiresAt} />
		</div>

		{#if showNoPasswordWarning}
			<div class="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
				<p class="font-medium">Anyone with this link can view your floorplan.</p>
				<div class="flex gap-2">
					<Button type="button" size="sm" variant="outline" onclick={() => (showNoPasswordWarning = false)}>
						Cancel
					</Button>
					<Button type="button" size="sm" onclick={() => createLink(true)}>
						Create without password
					</Button>
				</div>
			</div>
		{/if}

		{#if createError}
			<p class="text-sm text-red-600">{createError}</p>
		{/if}

		<Button class="w-full sm:w-auto" type="submit" disabled={isCreating}>
			{isCreating ? 'Creating...' : 'Create Share Link'}
		</Button>
	</form>

	{#if createdShareUrl}
		<div class="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs flex items-center gap-2 overflow-hidden">
			<span class="truncate flex-1 min-w-0">{createdShareUrl}</span>
			<Button type="button" variant="ghost" size="icon-sm" onclick={copyCreatedLink}>
				{#if copiedId === 'created'}
					<Check class="h-4 w-4" />
				{:else}
					<Copy class="h-4 w-4" />
				{/if}
			</Button>
		</div>
	{/if}

	<Separator />

	<div class="space-y-2">
		<h4 class="text-sm font-medium text-slate-800">Active links</h4>
		{#if isLoading}
			<p class="text-sm text-slate-500">Loading share links...</p>
		{:else if loadError}
			<p class="text-sm text-red-600">{loadError}</p>
		{:else if links.length === 0}
			<p class="text-sm text-slate-500">No share links yet.</p>
		{:else}
			{#each links as link (link.id)}
				<div class="rounded-lg border border-slate-200 p-3 space-y-2">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<p class="text-sm font-medium text-slate-900 truncate">
								{link.label || 'Untitled link'}
							</p>
							<p class="text-xs text-slate-500">Created: {formatDate(link.createdAt)}</p>
							<p class="text-xs text-slate-500">Expires: {formatDate(link.expiresAt)}</p>
						</div>
						{#if link.hasPassword}
							<span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
								<Lock class="h-3 w-3" />
								Password
							</span>
						{/if}
					</div>

					<div class="flex items-center gap-2">
						<Button type="button" variant="outline" size="sm" onclick={() => copyLink(link.token, link.id)}>
							{#if copiedId === link.id}
								<Check class="mr-1.5 h-4 w-4" />
								Copied
							{:else}
								<Copy class="mr-1.5 h-4 w-4" />
								Copy link
							{/if}
						</Button>
						<Button
							type="button"
							variant="destructive"
							size="sm"
							disabled={isRevokingId === link.id}
							onclick={() => revokeLink(link)}
						>
							<Trash2 class="mr-1.5 h-4 w-4" />
							Revoke
						</Button>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</section>
