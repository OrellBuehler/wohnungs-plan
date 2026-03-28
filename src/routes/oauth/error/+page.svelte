<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { page } from '$app/stores';
	import * as m from '$lib/paraglide/messages';

	const errorCodes: Record<string, { title: string; description: string; suggestions: string[] }> =
		{
			missing_params: {
				title: 'Missing Parameters',
				description:
					'The authorization request is missing one or more required parameters (client_id, redirect_uri, state, code_challenge, code_challenge_method).',
				suggestions: [
					'Ensure your MCP client is configured correctly',
					'Check that the authorization URL includes all required OAuth parameters',
					'Refer to the MCP Integration guide in Settings for the correct URL format'
				]
			},
			invalid_response_type: {
				title: 'Invalid Response Type',
				description:
					'The response_type parameter must be "code". Other grant types are not supported.',
				suggestions: [
					'Update your client configuration to use response_type=code',
					'Ensure you are using the Authorization Code flow with PKCE'
				]
			},
			invalid_code_challenge_method: {
				title: 'Invalid Code Challenge Method',
				description:
					'Only the S256 code challenge method is supported. The "plain" method is not allowed for security reasons.',
				suggestions: [
					'Update your client to use code_challenge_method=S256',
					'Generate a SHA-256 hash of your code verifier for the code challenge'
				]
			},
			invalid_code_challenge: {
				title: 'Invalid Code Challenge',
				description:
					'The code_challenge format is invalid. It must be a 43-character base64url-encoded SHA-256 hash (RFC 7636).',
				suggestions: [
					'Generate the code challenge as: BASE64URL(SHA256(code_verifier))',
					'Ensure no padding characters (=) are included',
					'Verify the result is exactly 43 characters long'
				]
			},
			invalid_redirect_uri_format: {
				title: 'Invalid Redirect URI Format',
				description:
					'The redirect URI must use HTTPS, or HTTP with localhost (127.0.0.1, [::1]) for local development.',
				suggestions: [
					'Use an HTTPS URL for production deployments',
					'For local testing, use http://localhost or http://127.0.0.1 with your port number'
				]
			},
			invalid_client: {
				title: 'Unknown Client',
				description: 'No OAuth client was found for the provided client_id.',
				suggestions: [
					'Verify the client_id in your MCP client configuration',
					'Go to Settings > MCP Integration to find your correct Client ID',
					'If you recently regenerated your credentials, update your client configuration'
				]
			},
			unregistered_redirect_uri: {
				title: 'Unregistered Redirect URI',
				description:
					'The provided redirect URI is not in the list of allowed URIs for this client.',
				suggestions: [
					'Go to Settings > MCP Integration and add the redirect URI to your allowed list',
					'Make sure the URI matches exactly, including the port number and trailing slash',
					'After adding the URI, retry the authorization request'
				]
			},
			unknown: {
				title: 'Authorization Error',
				description: 'An unexpected error occurred during the OAuth authorization flow.',
				suggestions: [
					'Try the authorization request again',
					'Check your MCP client configuration',
					'If the problem persists, try regenerating your credentials in Settings'
				]
			}
		};

	const code = $derived($page.url.searchParams.get('code') ?? 'unknown');
	const detail = $derived($page.url.searchParams.get('detail'));
	const error = $derived(errorCodes[code] ?? errorCodes['unknown']);
</script>

<div class="h-full overflow-y-auto bg-surface flex items-center justify-center p-4">
	<div class="w-full max-w-md">
		<Card.Root>
			<Card.Header>
				<div class="flex items-center gap-3 mb-2">
					<div
						class="flex items-center justify-center size-10 rounded-full bg-error-container text-destructive"
					>
						<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
					</div>
					<div>
						<Card.Title class="text-xl">{error.title}</Card.Title>
						<Card.Description>{m.oauth_error_page_subtitle()}</Card.Description>
					</div>
				</div>
			</Card.Header>

			<Card.Content>
				<div class="space-y-4">
					<p class="text-sm text-on-surface-variant">{error.description}</p>

					{#if detail}
						<div class="rounded-md bg-surface-container-low px-3 py-2">
							<p class="text-xs text-on-surface-variant mb-1">Detail</p>
							<p class="text-sm font-mono text-on-surface break-all">{detail}</p>
						</div>
					{/if}

					<div>
						<p class="text-sm font-medium text-on-surface mb-2">
							{m.oauth_error_suggestions_title()}
						</p>
						<ul class="space-y-2">
							{#each error.suggestions as suggestion}
								<li class="flex items-start gap-2 text-sm">
									<svg
										class="size-4 text-outline flex-shrink-0 mt-0.5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 5l7 7-7 7"
										/>
									</svg>
									<span class="text-on-surface-variant">{suggestion}</span>
								</li>
							{/each}
						</ul>
					</div>
				</div>
			</Card.Content>

			<div class="flex gap-3 px-6">
				<a href="/settings/mcp" class="flex-1">
					<Button variant="outline" class="w-full">{m.oauth_error_settings_link()}</Button>
				</a>
				<a href="/" class="flex-1">
					<Button class="w-full">{m.oauth_error_home_link()}</Button>
				</a>
			</div>
		</Card.Root>
	</div>
</div>
