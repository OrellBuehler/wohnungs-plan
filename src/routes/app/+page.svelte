<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/stores';
	import type { ProjectMeta } from '$lib/types';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import Plus from '@lucide/svelte/icons/plus';
	import Upload from '@lucide/svelte/icons/upload';
	import ProjectCard from '$lib/components/projects/ProjectCard.svelte';
	import ShareDialog from '$lib/components/sharing/ShareDialog.svelte';
	import SidebarTrigger from '$lib/components/layout/SidebarTrigger.svelte';
	import {
		listProjects,
		createProject,
		removeProject,
		syncProjectToCloud,
		loadProjectById,
		duplicateProject
	} from '$lib/stores/project.svelte';
	import { isAuthenticated, fetchUser, login } from '$lib/stores/auth.svelte';
	import {
		downloadProject,
		importProjectFromJSON,
		readFileAsJSON,
		fetchServerThumbnail,
		fetchServerFloorplan
	} from '$lib/utils/export';
	import { saveProject as saveLocalProject, saveThumbnail, getThumbnail } from '$lib/db';
	import * as m from '$lib/paraglide/messages';
	import { toast } from 'svelte-sonner';

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
	let invalidImportDialogOpen = $state(false);

	// Derived
	const authenticated = $derived(isAuthenticated());
	const showSignInBanner = $derived(!authenticated && projects.length > 0);

	onMount(async () => {
		const reason = $page.url.searchParams.get('reason');
		if (reason === 'auth_required') {
			toast.info(m.auth_login_required());
			const url = new URL($page.url);
			url.searchParams.delete('reason');
			replaceState(url, {});
		}
		await fetchUser();
		await loadProjects();
	});

	async function loadProjects() {
		isLoading = true;
		error = null;
		try {
			projects = await listProjects();
		} catch (err) {
			error = err instanceof Error ? err.message : m.project_load_error();
		} finally {
			isLoading = false;
		}
	}

	async function handleNew() {
		const project = createProject('New Project');
		await goto(`/app/projects/${project.id}`);
	}

	function handleOpen(id: string) {
		goto(`/app/projects/${id}`);
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

	async function handleExport(id: string) {
		const project = await loadProjectById(id);
		if (!project) return;

		let thumbnail: string | null = null;
		if (project.isLocal) {
			thumbnail = await getThumbnail(project.id);
		} else {
			thumbnail = await fetchServerThumbnail(project.id);
		}

		let exportProject = project;
		if (!project.isLocal && project.floorplan?.imageData?.startsWith('/api/')) {
			const floorplanData = await fetchServerFloorplan(project.floorplan.imageData);
			if (floorplanData) {
				exportProject = {
					...project,
					floorplan: {
						...project.floorplan,
						imageData: floorplanData
					}
				};
			}
		}

		downloadProject(exportProject, thumbnail);
	}

	async function handleDuplicate(id: string) {
		const result = await duplicateProject(id);
		if (result) {
			await loadProjects();
		}
	}

	async function handleImport() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (file) {
				const json = await readFileAsJSON(file);
				const { project: imported, thumbnail } = importProjectFromJSON(json);
				if (imported) {
					await saveLocalProject(imported);
					if (thumbnail) {
						try {
							await saveThumbnail(imported.id, thumbnail);
						} catch {
							// thumbnail save is a background operation; silently ignore
						}
					}
					await loadProjects();
				} else {
					invalidImportDialogOpen = true;
				}
			}
		};
		input.click();
	}
</script>

<div class="flex flex-col flex-1 overflow-hidden">
	<!-- Header -->
	<header
		class="min-h-14 bg-surface-container-lowest/80 backdrop-blur-[12px] flex items-center justify-between px-4 py-3 flex-shrink-0"
		style="padding-top: max(0.75rem, env(safe-area-inset-top));"
	>
		<a href="/" class="flex items-center gap-2 md:hidden">
			<img src="/icon.svg" alt={m.app_title()} class="size-8" />
			<h1 class="font-display text-xl font-semibold text-on-surface">{m.app_title()}</h1>
		</a>
		<h1 class="font-display hidden md:block text-xl font-semibold text-on-surface">
			{m.home_title()}
		</h1>
		<span class="sr-only md:hidden" role="heading" aria-level={2}>{m.home_title()}</span>
		<div class="flex-shrink-0 md:hidden">
			<SidebarTrigger />
		</div>
	</header>

	<!-- Main -->
	<main class="flex-1 overflow-y-auto min-h-0">
		<div
			class="p-4 md:p-8 max-w-6xl mx-auto w-full"
			style="padding-bottom: max(1rem, env(safe-area-inset-bottom));"
		>
			<!-- Actions -->
			<div class="flex items-center justify-end flex-wrap gap-4 mb-6">
				<div class="flex items-center gap-2">
					<Button variant="outline" onclick={handleImport}>
						<Upload class="size-4 mr-2" />
						{m.home_import_json()}
					</Button>
					<Button onclick={handleNew}>
						<Plus class="size-4 mr-2" />
						{m.home_new_project()}
					</Button>
				</div>
			</div>

			<!-- Loading state -->
			{#if isLoading}
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
					{#each Array(6) as _}
						<div class="rounded-lg bg-surface-container-lowest overflow-hidden">
							<div class="aspect-video bg-surface-container animate-pulse"></div>
							<div class="p-3 space-y-2">
								<div class="h-5 bg-surface-container rounded animate-pulse w-3/4"></div>
								<div class="h-4 bg-surface-container rounded animate-pulse w-1/2"></div>
							</div>
						</div>
					{/each}
				</div>

				<!-- Error state -->
			{:else if error}
				<div class="flex flex-col items-center justify-center py-16 text-center">
					<p class="text-destructive mb-4">{error}</p>
					<Button variant="outline" onclick={loadProjects}>{m.common_retry()}</Button>
				</div>

				<!-- Empty state -->
			{:else if projects.length === 0}
				<div class="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
					<svg
						viewBox="0 0 200 140"
						class="w-48 mb-6"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<rect
							x="20"
							y="10"
							width="160"
							height="120"
							rx="4"
							class="stroke-outline"
							stroke-width="1.5"
							stroke-dasharray="4 3"
						/>
						<line
							x1="60"
							y1="10"
							x2="60"
							y2="130"
							class="stroke-surface-container-highest"
							stroke-width="0.5"
						/>
						<line
							x1="100"
							y1="10"
							x2="100"
							y2="130"
							class="stroke-surface-container-highest"
							stroke-width="0.5"
						/>
						<line
							x1="140"
							y1="10"
							x2="140"
							y2="130"
							class="stroke-surface-container-highest"
							stroke-width="0.5"
						/>
						<line
							x1="20"
							y1="42"
							x2="180"
							y2="42"
							class="stroke-surface-container-highest"
							stroke-width="0.5"
						/>
						<line
							x1="20"
							y1="74"
							x2="180"
							y2="74"
							class="stroke-surface-container-highest"
							stroke-width="0.5"
						/>
						<line
							x1="20"
							y1="106"
							x2="180"
							y2="106"
							class="stroke-surface-container-highest"
							stroke-width="0.5"
						/>
						<rect
							x="32"
							y="22"
							width="56"
							height="28"
							rx="3"
							class="fill-surface-container-high stroke-on-surface-variant"
							stroke-width="1"
						/>
						<rect
							x="112"
							y="56"
							width="44"
							height="32"
							rx="2"
							class="fill-surface-container-high stroke-on-surface-variant"
							stroke-width="1"
						/>
						<rect
							x="36"
							y="80"
							width="48"
							height="40"
							rx="3"
							class="fill-secondary/15 stroke-secondary"
							stroke-width="1.5"
						/>
						<rect
							x="124"
							y="22"
							width="16"
							height="16"
							rx="2"
							class="fill-surface-container stroke-on-surface-variant"
							stroke-width="0.75"
						/>
						<circle
							cx="158"
							cy="104"
							r="10"
							class="fill-surface-container stroke-on-surface-variant"
							stroke-width="0.75"
						/>
						<line x1="160" y1="130" x2="180" y2="130" class="stroke-surface" stroke-width="3" />
						<path
							d="M160 130 Q160 112, 178 130"
							class="stroke-outline"
							stroke-width="1"
							fill="none"
							stroke-dasharray="3 2"
						/>
					</svg>
					<h3 class="font-display text-lg font-semibold text-on-surface mb-2">
						{m.home_empty_title()}
					</h3>
					<p class="text-on-surface-variant text-sm mb-6">{m.home_empty_description()}</p>
					<Button onclick={handleNew}>
						<Plus class="size-4 mr-2" />
						{m.home_empty_cta()}
					</Button>
					<button
						type="button"
						class="mt-3 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
						onclick={handleImport}
					>
						{m.home_empty_import()}
					</button>
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
							onExport={handleExport}
							onDuplicate={handleDuplicate}
						/>
					{/each}
				</div>
			{/if}

			<!-- Sign-in banner -->
			{#if showSignInBanner}
				<div class="mt-8 p-4 bg-secondary-fixed rounded-lg flex items-center justify-between">
					<p class="text-sm text-on-surface">
						{m.home_sign_in_banner()}
					</p>
					<Button variant="outline" onclick={login}>{m.common_sign_in()}</Button>
				</div>
			{/if}
		</div>
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
			<Dialog.Title>{m.home_delete_title()}</Dialog.Title>
			<Dialog.Description class="break-words">
				{m.home_delete_description({ name: deleteProject?.name ?? '' })}
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="gap-2">
			<Button variant="outline" class="w-full sm:w-auto" onclick={() => (deleteDialogOpen = false)}
				>{m.common_cancel()}</Button
			>
			<Button variant="destructive" class="w-full sm:w-auto" onclick={confirmDelete}
				>{m.common_delete()}</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={invalidImportDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{m.home_invalid_import_title()}</Dialog.Title>
			<Dialog.Description>
				{m.home_invalid_import_description()}
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button class="w-full sm:w-auto" onclick={() => (invalidImportDialogOpen = false)}
				>{m.common_ok()}</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
