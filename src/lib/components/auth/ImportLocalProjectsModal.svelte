<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { getAllProjects, getProject } from '$lib/db';
	import type { Project, ProjectMeta } from '$lib/types';
	import { Upload, FolderOpen } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	interface Props {
		open: boolean;
		onClose: () => void;
		onImport: (projects: Project[]) => Promise<void>;
	}

	let { open = $bindable(), onClose, onImport }: Props = $props();

	let localProjects = $state<ProjectMeta[]>([]);
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
		const selectedProjects = localProjects.filter((p) => selectedIds.has(p.id));
		if (selectedProjects.length === 0) {
			onClose();
			return;
		}

		isImporting = true;
		try {
			// Load full project data for selected projects
			const fullProjects = await Promise.all(
				selectedProjects.map((p) => getProject(p.id))
			);
			const validProjects = fullProjects.filter((p): p is Project => p !== null);
			await onImport(validProjects);
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
				{m.auth_import_title()}
			</Dialog.Title>
			<Dialog.Description>
				{m.auth_import_description({ count: localProjects.length.toString() })}
			</Dialog.Description>
		</Dialog.Header>

		{#if isLoading}
			<div class="py-8 text-center text-muted-foreground">{m.common_loading()}</div>
		{:else if localProjects.length === 0}
			<div class="py-8 text-center text-muted-foreground">
				{m.auth_import_empty()}
			</div>
		{:else}
			<div class="space-y-3 max-h-64 overflow-y-auto py-4">
				<div class="flex items-center gap-2 pb-2 border-b">
					<Checkbox
						checked={selectedIds.size === localProjects.length}
						onCheckedChange={toggleAll}
					/>
					<span class="text-sm font-medium">{m.auth_import_select_all()}</span>
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
								{m.auth_import_updated({ date: new Date(project.updatedAt).toLocaleDateString(getLocale()) })}
							</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<Dialog.Footer class="gap-2">
			<Button variant="outline" onclick={onClose}>
				{m.auth_import_skip()}
			</Button>
			<Button
				onclick={handleImport}
				disabled={isImporting || selectedIds.size === 0}
			>
				{isImporting ? m.auth_import_importing() : m.auth_import_button({ count: selectedIds.size.toString() })}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
