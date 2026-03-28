<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages';
	import LanguageSwitcher from '$lib/components/layout/LanguageSwitcher.svelte';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>General Settings - Floorplanner</title>
</svelte:head>

<div class="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
	<div>
		<h1 class="text-3xl font-bold text-on-surface">{m.settings_general_title()}</h1>
		<p class="text-on-surface-variant mt-1">{m.settings_general_description()}</p>
	</div>

	<!-- Profile Card -->
	<Card.Root>
		<Card.Header>
			<Card.Title>{m.settings_general_profile_title()}</Card.Title>
			<Card.Description>
				{m.settings_general_profile_description()}
			</Card.Description>
		</Card.Header>

		<Card.Content class="space-y-4">
			<div class="space-y-2">
				<Label for="name">{m.settings_general_name()}</Label>
				<Input id="name" type="text" readonly value={data.user.name ?? '—'} class="bg-surface" />
			</div>

			<div class="space-y-2">
				<Label for="email">{m.settings_general_email()}</Label>
				<Input
					id="email"
					type="email"
					readonly
					value={data.user.email ?? '—'}
					class="bg-surface"
				/>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Preferences Card -->
	<Card.Root>
		<Card.Header>
			<Card.Title>{m.settings_general_preferences_title()}</Card.Title>
			<Card.Description>{m.settings_general_preferences_description()}</Card.Description>
		</Card.Header>

		<Card.Content>
			<LanguageSwitcher />
		</Card.Content>
	</Card.Root>

	<p class="text-xs text-outline">Version {import.meta.env.VITE_APP_VERSION || 'dev'}</p>
</div>
