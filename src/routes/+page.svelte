<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { ProjectMeta } from '$lib/types';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Plus } from 'lucide-svelte';
	import House from 'lucide-svelte/icons/house';
	import ProjectCard from '$lib/components/projects/ProjectCard.svelte';
	import ShareDialog from '$lib/components/sharing/ShareDialog.svelte';
	import LoginButton from '$lib/components/auth/LoginButton.svelte';
	import UserMenu from '$lib/components/auth/UserMenu.svelte';
	import {
		listProjects,
		createProject,
		removeProject,
		syncProjectToCloud
	} from '$lib/stores/project.svelte';
	import { isAuthenticated, fetchUser } from '$lib/stores/auth.svelte';

	// State
	let projects = $state<ProjectMeta[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	// Share dialog state
	let shareDialogOpen = $state(false);
	let shareProjectId = $state<string | null>(null);

	// Delete dialog state
	let deleteDialogOpen = $state(false);
	let deleteProject = $state<ProjectMeta | null>(null);

	// Derived
	const authenticated = $derived(isAuthenticated());
	const showSignInBanner = $derived(!authenticated && projects.length > 0);

	onMount(async () => {
		await fetchUser();
		await loadProjects();
	});

	async function loadProjects() {
		isLoading = true;
		error = null;
		try {
			projects = await listProjects();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load projects';
		} finally {
			isLoading = false;
		}
	}

	async function handleNew() {
		const project = createProject('New Project');
		await goto(`/projects/${project.id}`);
	}

	function handleOpen(id: string) {
		goto(`/projects/${id}`);
	}

	function handleShare(id: string) {
		shareProjectId = id;
		shareDialogOpen = true;
	}

	function handleDeleteClick(id: string) {
		const project = projects.find((p) => p.id === id);
		if (project) {
			deleteProject = project;
			deleteDialogOpen = true;
		}
	}

	async function confirmDelete() {
		if (deleteProject) {
			await removeProject(deleteProject.id);
			deleteDialogOpen = false;
			deleteProject = null;
			await loadProjects();
		}
	}

	async function handleSync(id: string) {
		const success = await syncProjectToCloud(id);
		if (success) {
			await loadProjects();
		}
	}
</script>

<div class="min-h-screen bg-slate-50 flex flex-col">
	<!-- Header -->
	<header class="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
		<a href="/" class="flex items-center gap-2">
			<img src="/icon.svg" alt="Floorplanner" class="size-8" />
			<h1 class="text-xl font-semibold text-slate-800">Floorplanner</h1>
		</a>
		<div>
			{#if authenticated}
				<UserMenu />
			{:else}
				<LoginButton />
			{/if}
		</div>
	</header>

	<!-- Main -->
	<main class="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
		<!-- Title + New button -->
		<div class="flex items-center justify-between mb-6">
			<h2 class="text-2xl font-bold text-slate-800">My Projects</h2>
			<Button onclick={handleNew}>
				<Plus class="size-4 mr-2" />
				New Project
			</Button>
		</div>

		<!-- Loading state -->
		{#if isLoading}
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
				{#each Array(6) as _}
					<div class="rounded-lg border border-slate-200 bg-white overflow-hidden">
						<div class="aspect-video bg-slate-100 animate-pulse"></div>
						<div class="p-3 space-y-2">
							<div class="h-5 bg-slate-100 rounded animate-pulse w-3/4"></div>
							<div class="h-4 bg-slate-100 rounded animate-pulse w-1/2"></div>
						</div>
					</div>
				{/each}
			</div>

		<!-- Error state -->
		{:else if error}
			<div class="flex flex-col items-center justify-center py-16 text-center">
				<p class="text-red-600 mb-4">{error}</p>
				<Button variant="outline" onclick={loadProjects}>Retry</Button>
			</div>

		<!-- Empty state -->
		{:else if projects.length === 0}
			<div class="flex flex-col items-center justify-center py-16 text-center">
				<House class="size-16 text-slate-300 mb-4" />
				<h3 class="text-lg font-medium text-slate-800 mb-2">No projects yet</h3>
				<p class="text-slate-500 mb-6">Create your first floor plan project to get started.</p>
				<Button onclick={handleNew}>
					<Plus class="size-4 mr-2" />
					Create your first project
				</Button>
			</div>

		<!-- Projects grid -->
		{:else}
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
				{#each projects as project (project.id)}
					<ProjectCard
						{project}
						onOpen={handleOpen}
						onDelete={handleDeleteClick}
						onShare={handleShare}
						onSync={handleSync}
					/>
				{/each}
			</div>
		{/if}

		<!-- Sign-in banner -->
		{#if showSignInBanner}
			<div class="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between">
				<p class="text-sm text-blue-800">
					Sign in to sync and share your projects across devices
				</p>
				<LoginButton />
			</div>
		{/if}
	</main>
</div>

<!-- Share Dialog -->
{#if shareProjectId}
	<ShareDialog
		bind:open={shareDialogOpen}
		projectId={shareProjectId}
		onClose={() => {
			shareDialogOpen = false;
			shareProjectId = null;
		}}
	/>
{/if}

<!-- Delete Confirmation Dialog -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Delete Project</Dialog.Title>
			<Dialog.Description>
				Are you sure you want to delete "{deleteProject?.name}"? This action cannot be undone.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="gap-2">
			<Button variant="outline" onclick={() => (deleteDialogOpen = false)}>Cancel</Button>
			<Button variant="destructive" onclick={confirmDelete}>Delete</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
