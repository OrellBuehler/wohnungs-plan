<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import { Separator } from '$lib/components/ui/separator';

	interface Props {
		open: boolean;
		projectId: string;
		onClose: () => void;
	}

	let { open = $bindable(), projectId, onClose }: Props = $props();

	const TOOL_CATEGORIES = [
		{
			title: 'Project',
			tools: [
				{ name: 'list_branches', label: 'List Branches', description: 'View all branches in the project' },
				{ name: 'create_branch', label: 'Create Branch', description: 'Create new branches to explore alternative layouts' }
			]
		},
		{
			title: 'Items',
			tools: [
				{ name: 'add_furniture_item', label: 'Add Item', description: 'Add new furniture to the inventory' },
				{ name: 'update_furniture_item', label: 'Update Item', description: 'Change item properties or position' },
				{ name: 'delete_furniture_item', label: 'Delete Item', description: 'Permanently remove an item' },
				{ name: 'batch_add_items', label: 'Batch Add Items', description: 'Add multiple items at once' },
				{ name: 'batch_update_items', label: 'Batch Update Items', description: 'Reposition or update multiple items at once' },
				{ name: 'list_furniture_items', label: 'List Items', description: 'View all items in a branch' }
			]
		},
		{
			title: 'Images',
			tools: [
				{ name: 'add_item_image_from_url', label: 'Add Image from URL', description: 'Download and attach a product photo' },
				{ name: 'list_item_images', label: 'List Images', description: 'View images attached to an item' },
				{ name: 'delete_item_image', label: 'Delete Image', description: 'Remove an image from an item' }
			]
		},
		{
			title: 'Preview',
			tools: [{ name: 'get_project_preview', label: 'Get Preview', description: 'View a visual snapshot of the layout' }]
		},
		{
			title: 'Floorplan',
			tools: [
				{ name: 'save_floorplan_analysis', label: 'Save Analysis', description: 'Save detected rooms, walls, and doors' },
				{ name: 'get_floorplan_analysis', label: 'Get Analysis', description: 'Read the saved floorplan structure' }
			]
		},
		{
			title: 'Spatial',
			tools: [
				{ name: 'get_room_contents', label: 'Room Contents', description: 'List items placed in a specific room' },
				{ name: 'get_available_space', label: 'Available Space', description: 'Calculate remaining floor space in a room' },
				{ name: 'check_placement', label: 'Check Placement', description: 'Validate a position before placing an item' },
				{ name: 'suggest_placement', label: 'Suggest Placement', description: 'Find a valid position for an item in a room' }
			]
		},
		{
			title: 'Comments',
			tools: [
				{ name: 'list_comments', label: 'List Comments', description: 'View all comment threads' },
				{ name: 'add_comment_reply', label: 'Add Reply', description: 'Reply to an existing comment thread' }
			]
		}
	] as const;

	let disabledTools = $state<Set<string>>(new Set());
	let savedDisabledTools = $state<Set<string>>(new Set());
	let isLoading = $state(false);
	let isSaving = $state(false);
	let errorMessage = $state<string | null>(null);

	const hasChanges = $derived.by(() => {
		if (disabledTools.size !== savedDisabledTools.size) return true;
		for (const t of disabledTools) {
			if (!savedDisabledTools.has(t)) return true;
		}
		return false;
	});

	$effect(() => {
		if (open && projectId) {
			loadSettings();
		}
	});

	async function loadSettings() {
		isLoading = true;
		errorMessage = null;
		try {
			const res = await fetch(`/api/projects/${projectId}/mcp-tools`);
			if (!res.ok) throw new Error('Failed to load settings');
			const data = await res.json();
			disabledTools = new Set(data.disabledTools);
			savedDisabledTools = new Set(data.disabledTools);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to load settings';
		} finally {
			isLoading = false;
		}
	}

	async function handleSave() {
		isSaving = true;
		errorMessage = null;
		try {
			const res = await fetch(`/api/projects/${projectId}/mcp-tools`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ disabledTools: [...disabledTools] })
			});
			if (!res.ok) throw new Error('Failed to save settings');
			savedDisabledTools = new Set(disabledTools);
			open = false;
			onClose();
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to save settings';
		} finally {
			isSaving = false;
		}
	}

	function handleCancel() {
		disabledTools = new Set(savedDisabledTools);
		open = false;
		onClose();
	}

	function toggleTool(toolName: string, enabled: boolean) {
		const next = new Set(disabledTools);
		if (enabled) {
			next.delete(toolName);
		} else {
			next.add(toolName);
		}
		disabledTools = next;
	}
</script>

<Dialog.Root bind:open onOpenChange={(o) => !o && handleCancel()}>
	<Dialog.Content class="sm:max-w-lg max-h-[80vh] flex flex-col">
		<Dialog.Header>
			<Dialog.Title>MCP Tool Permissions</Dialog.Title>
			<Dialog.Description>
				Control which tools AI assistants can use in this project.
			</Dialog.Description>
		</Dialog.Header>

		{#if isLoading}
			<div class="flex items-center justify-center py-8 text-sm text-slate-500">
				Loading...
			</div>
		{:else if errorMessage}
			<div class="text-sm text-red-600 py-4">{errorMessage}</div>
		{:else}
			<div class="flex-1 overflow-y-auto space-y-4 py-2 -mx-6 px-6">
				{#each TOOL_CATEGORIES as category, i}
					{#if i > 0}
						<Separator />
					{/if}
					<div>
						<h3 class="text-sm font-medium text-slate-700 mb-2">{category.title}</h3>
						<div class="space-y-2">
							{#each category.tools as tool}
								<div class="flex items-center justify-between gap-4 py-1">
									<div class="flex flex-col">
										<span class="text-sm">{tool.label}</span>
										<span class="text-xs text-muted-foreground">{tool.description}</span>
									</div>
									<Switch
										checked={!disabledTools.has(tool.name)}
										onCheckedChange={(checked) => toggleTool(tool.name, checked)}
									/>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<Dialog.Footer class="gap-2">
			<Button variant="outline" class="w-full sm:w-auto" onclick={handleCancel}>Cancel</Button>
			<Button
				class="w-full sm:w-auto"
				onclick={handleSave}
				disabled={isSaving || isLoading || !hasChanges}
			>
				{isSaving ? 'Saving...' : 'Save'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
