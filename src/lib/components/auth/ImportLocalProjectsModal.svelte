<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { getAllProjects } from '$lib/db';
	import type { Project } from '$lib/types';
	import { Upload, FolderOpen } from 'lucide-svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
		onImport: (projects: Project[]) => Promise<void>;
	}

	let { open = $bindable(), onClose, onImport }: Props = $props();

	let localProjects = $state<Project[]>([]);
	let selectedIds = $state<Set<string>>(new Set());
	let isLoading = $state(false);
	let isImporting = $state(false);

	$effect(() => {
		if (open) {
			loadLocalProjects();
		}
	});

	async function loadLocalProjects(): Promise<void> {
		isLoading = true;
		try {
			localProjects = await getAllProjects();
			// Select all by default
			selectedIds = new Set(localProjects.map((p) => p.id));
		} catch (err) {
			console.error('Failed to load local projects:', err);
		} finally {
			isLoading = false;
		}
	}

	function toggleProject(id: string): void {
		if (selectedIds.has(id)) {
			selectedIds.delete(id);
		} else {
			selectedIds.add(id);
		}
		selectedIds = new Set(selectedIds);
	}

	function toggleAll(): void {
		if (selectedIds.size === localProjects.length) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(localProjects.map((p) => p.id));
		}
	}

	async function handleImport(): Promise<void> {
		const projectsToImport = localProjects.filter((p) => selectedIds.has(p.id));
		if (projectsToImport.length === 0) {
			onClose();
			return;
		}

		isImporting = true;
		try {
			await onImport(projectsToImport);
			onClose();
		} catch (err) {
			console.error('Import failed:', err);
		} finally {
			isImporting = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<Upload class="h-5 w-5" />
				Import Local Projects
			</Dialog.Title>
			<Dialog.Description>
				You have {localProjects.length} project{localProjects.length !== 1 ? 's' : ''} saved locally.
				Select which ones to import to your account.
			</Dialog.Description>
		</Dialog.Header>

		{#if isLoading}
			<div class="py-8 text-center text-muted-foreground">Loading...</div>
		{:else if localProjects.length === 0}
			<div class="py-8 text-center text-muted-foreground">
				No local projects found.
			</div>
		{:else}
			<div class="space-y-3 max-h-64 overflow-y-auto py-4">
				<div class="flex items-center gap-2 pb-2 border-b">
					<Checkbox
						checked={selectedIds.size === localProjects.length}
						onCheckedChange={toggleAll}
					/>
					<span class="text-sm font-medium">Select all</span>
				</div>

				{#each localProjects as project (project.id)}
					<div class="flex items-center gap-3">
						<Checkbox
							checked={selectedIds.has(project.id)}
							onCheckedChange={() => toggleProject(project.id)}
						/>
						<FolderOpen class="h-4 w-4 text-muted-foreground" />
						<div class="flex-1 min-w-0">
							<p class="text-sm font-medium truncate">{project.name}</p>
							<p class="text-xs text-muted-foreground">
								{project.items.length} item{project.items.length !== 1 ? 's' : ''}
							</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<Dialog.Footer class="gap-2">
			<Button variant="outline" onclick={onClose}>
				Skip
			</Button>
			<Button
				onclick={handleImport}
				disabled={isImporting || selectedIds.size === 0}
			>
				{isImporting ? 'Importing...' : `Import ${selectedIds.size} project${selectedIds.size !== 1 ? 's' : ''}`}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
