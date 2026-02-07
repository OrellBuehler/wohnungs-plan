<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>General Settings - Floorplanner</title>
</svelte:head>

<div class="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
	<div>
		<h1 class="text-3xl font-bold text-slate-900">General</h1>
		<p class="text-slate-600 mt-1">Manage your account and preferences</p>
	</div>

	<!-- Profile Card -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Profile</Card.Title>
			<Card.Description>
				Your profile information is managed by your OAuth provider
			</Card.Description>
		</Card.Header>

		<Card.Content class="space-y-4">
			<div class="space-y-2">
				<Label for="name">Name</Label>
				<Input
					id="name"
					type="text"
					readonly
					value={data.user.name ?? '—'}
					class="bg-slate-50"
				/>
			</div>

			<div class="space-y-2">
				<Label for="email">Email</Label>
				<Input
					id="email"
					type="email"
					readonly
					value={data.user.email ?? '—'}
					class="bg-slate-50"
				/>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Preferences Card -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Preferences</Card.Title>
			<Card.Description>Customize your experience</Card.Description>
		</Card.Header>

		<Card.Content>
			<p class="text-sm text-slate-500">More preferences coming soon.</p>
		</Card.Content>
	</Card.Root>
</div>
