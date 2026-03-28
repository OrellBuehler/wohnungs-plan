<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import type { PageData, ActionData } from './$types';
	import * as m from '$lib/paraglide/messages';
	import { toast } from 'svelte-sonner';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Track which field was just copied
	let copiedField: 'clientId' | 'clientSecret' | 'serverUrl' | null = $state(null);

	// Track new redirect URI input
	let newRedirectUri = $state('');

	// Get the active client secret (from form action result or initial load)
	let activeClientSecret = $derived(form?.clientSecret || data.clientSecret);

	// Copy to clipboard
	async function copyToClipboard(text: string, field: 'clientId' | 'clientSecret' | 'serverUrl') {
		try {
			await navigator.clipboard.writeText(text);
			copiedField = field;
			setTimeout(() => {
				copiedField = null;
			}, 2000);
		} catch {
			toast.error(m.settings_mcp_copy_error());
		}
	}

	// Instructions for setting up MCP in claude.ai
	const setupInstructions = $derived([
		m.settings_mcp_step1_instruction_1(),
		m.settings_mcp_step1_instruction_2(),
		m.settings_mcp_step1_instruction_3(),
		m.settings_mcp_step1_instruction_4()
	]);
</script>

<svelte:head>
	<title>MCP Settings - Floorplanner</title>
</svelte:head>

<div class="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
	<div>
		<h1 class="text-3xl font-bold text-slate-900">{m.settings_mcp_title()}</h1>
		<p class="text-slate-600 mt-1">
			{m.settings_mcp_description()}
		</p>
	</div>

	<!-- OAuth Credentials Card -->
	<Card.Root>
		<Card.Header>
			<Card.Title>{m.settings_mcp_oauth_title()}</Card.Title>
			<Card.Description>
				{m.settings_mcp_oauth_description()}
			</Card.Description>
		</Card.Header>

		<Card.Content class="space-y-4">
			<!-- Server URL -->
			<div class="space-y-2">
				<Label for="serverUrl">{m.settings_mcp_server_url()}</Label>
				<div class="flex gap-2">
					<Input
						id="serverUrl"
						type="text"
						readonly
						value={data.serverUrl}
						class="font-mono text-sm flex-1"
					/>
					<Button
						variant="outline"
						size="sm"
						onclick={() => data.serverUrl && copyToClipboard(data.serverUrl, 'serverUrl')}
					>
						{copiedField === 'serverUrl' ? m.common_copied() : m.common_copy()}
					</Button>
				</div>
			</div>

			<!-- Client ID -->
			<div class="space-y-2">
				<Label for="clientId">{m.settings_mcp_client_id()}</Label>
				<div class="flex gap-2">
					<Input
						id="clientId"
						type="text"
						readonly
						value={data.clientId}
						class="font-mono text-sm flex-1"
					/>
					<Button
						variant="outline"
						size="sm"
						onclick={() => data.clientId && copyToClipboard(data.clientId, 'clientId')}
					>
						{copiedField === 'clientId' ? m.common_copied() : m.common_copy()}
					</Button>
				</div>
			</div>

			<!-- Client Secret -->
			<div class="space-y-2">
				<Label for="clientSecret">{m.settings_mcp_client_secret()}</Label>
				{#if activeClientSecret}
					<div class="flex gap-2">
						<Input
							id="clientSecret"
							type="text"
							readonly
							value={activeClientSecret}
							class="font-mono text-sm flex-1"
						/>
						<Button
							variant="outline"
							size="sm"
							onclick={() => copyToClipboard(activeClientSecret, 'clientSecret')}
						>
							{copiedField === 'clientSecret' ? m.common_copied() : m.common_copy()}
						</Button>
					</div>
					<p class="text-sm text-amber-600 flex items-start gap-2">
						<svg
							class="size-5 flex-shrink-0 mt-0.5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
						<span>
							{m.settings_mcp_secret_warning()}
						</span>
					</p>
				{:else}
					<div class="rounded-md bg-slate-100 border border-slate-200 p-4">
						<p class="text-sm text-slate-600">
							{m.settings_mcp_secret_hidden()}
						</p>
					</div>
				{/if}
			</div>

			<!-- Regenerate Secret -->
			<div class="pt-4 border-t">
				<div class="space-y-3">
					<div>
						<h4 class="font-medium text-slate-900">{m.settings_mcp_regenerate_title()}</h4>
						<p class="text-sm text-slate-600 mt-1">
							{m.settings_mcp_regenerate_description()}
						</p>
					</div>
					<form method="POST" action="?/regenerate" use:enhance>
						<Button type="submit" variant="outline" class="w-full md:w-auto">
							{m.settings_mcp_regenerate_button()}
						</Button>
					</form>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Allowed Redirect URIs Card -->
	<Card.Root>
		<Card.Header>
			<Card.Title>{m.settings_mcp_redirect_title()}</Card.Title>
			<Card.Description>
				{m.settings_mcp_redirect_description()}
			</Card.Description>
		</Card.Header>

		<Card.Content class="space-y-4">
			<!-- Add New Redirect URI -->
			<form method="POST" action="?/addRedirectUri" use:enhance class="flex gap-2">
				<Input
					type="url"
					name="redirectUri"
					placeholder={m.settings_mcp_redirect_placeholder()}
					bind:value={newRedirectUri}
					class="flex-1"
				/>
				<Button type="submit" variant="outline" disabled={!newRedirectUri}>
					{m.common_add()}
				</Button>
			</form>

			<!-- List of Registered URIs -->
			{#if data.allowedRedirectUris && data.allowedRedirectUris.length > 0}
				<div class="space-y-2">
					<Label>{m.settings_mcp_registered_uris()}</Label>
					<ul class="space-y-2">
						{#each data.allowedRedirectUris as uri}
							<li class="flex items-center justify-between rounded-md border bg-slate-50 px-3 py-2">
								<code class="text-sm font-mono truncate flex-1">{uri}</code>
								<form method="POST" action="?/removeRedirectUri" use:enhance class="ml-2">
									<input type="hidden" name="redirectUri" value={uri} />
									<Button
										type="submit"
										variant="ghost"
										size="sm"
										class="text-red-600 hover:text-red-700 hover:bg-red-50"
									>
										{m.common_remove()}
									</Button>
								</form>
							</li>
						{/each}
					</ul>
				</div>
			{:else}
				<div class="rounded-md bg-amber-50 border border-amber-200 p-4">
					<p class="text-sm text-amber-700">
						{m.settings_mcp_no_uris_warning()}
					</p>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<!-- Setup Instructions Card -->
	<Card.Root>
		<Card.Header>
			<Card.Title>{m.settings_mcp_setup_title()}</Card.Title>
			<Card.Description>{m.settings_mcp_setup_description()}</Card.Description>
		</Card.Header>

		<Card.Content>
			<div class="space-y-4">
				<div>
					<h4 class="font-medium text-slate-900 mb-3">{m.settings_mcp_step1_title()}</h4>
					<ol class="space-y-2 list-decimal list-inside">
						{#each setupInstructions as instruction}
							<li class="text-sm text-slate-700">{instruction}</li>
						{/each}
					</ol>
				</div>

				<div class="pt-4 border-t">
					<h4 class="font-medium text-slate-900 mb-3">{m.settings_mcp_step2_title()}</h4>
					<p class="text-sm text-slate-700">
						{m.settings_mcp_step2_description()}
					</p>
				</div>

				<div class="pt-4 border-t">
					<h4 class="font-medium text-slate-900 mb-3">{m.settings_mcp_step3_title()}</h4>
					<ul class="space-y-2">
						{#each [m.settings_mcp_capability_1(), m.settings_mcp_capability_2(), m.settings_mcp_capability_3(), m.settings_mcp_capability_4(), m.settings_mcp_capability_5(), m.settings_mcp_capability_6(), m.settings_mcp_capability_7(), m.settings_mcp_capability_8(), m.settings_mcp_capability_9()] as capability}
							<li class="flex items-start gap-2 text-sm">
								<svg
									class="size-5 text-green-600 flex-shrink-0 mt-0.5"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M5 13l4 4L19 7"
									/>
								</svg>
								<span class="text-slate-700">{capability}</span>
							</li>
						{/each}
					</ul>
				</div>
			</div>
		</Card.Content>
	</Card.Root>
</div>
