<script lang="ts">
	import type { ProjectMeta } from '$lib/types';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Cloud, HardDrive, Users, MoreVertical, Trash2, Share2, Upload, Download } from 'lucide-svelte';
	import { isAuthenticated } from '$lib/stores/auth.svelte';
	import { getLocalFloorplanUrl } from '$lib/stores/project.svelte';
	import { onMount } from 'svelte';
	import House from 'lucide-svelte/icons/house';

	interface Props {
		project: ProjectMeta;
		onOpen: (id: string) => void;
		onDelete: (id: string) => void;
		onShare: (id: string) => void;
		onSync: (id: string) => void;
		onExport: (id: string) => void;
	}

	let { project, onOpen, onDelete, onShare, onSync, onExport }: Props = $props();

	let localThumbnailUrl = $state<string | null>(null);

	function formatRelativeTime(iso: string): string {
		const diff = Date.now() - new Date(iso).getTime();
		const minutes = Math.floor(diff / 60000);
		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		if (days < 7) return `${days}d ago`;
		return new Date(iso).toLocaleDateString();
	}

	const thumbnailUrl = $derived(project.isLocal ? localThumbnailUrl : project.floorplanUrl);
	const relativeTime = $derived(formatRelativeTime(project.updatedAt));
	const showMemberBadge = $derived(!project.isLocal && project.memberCount > 1);

	onMount(async () => {
		if (project.isLocal) {
			localThumbnailUrl = await getLocalFloorplanUrl(project.id);
		}
	});

	function handleCardClick() {
		onOpen(project.id);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onOpen(project.id);
		}
	}

	function stopPropagation(e: Event) {
		e.stopPropagation();
	}
</script>

<div
	class="group relative rounded-lg border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-md cursor-pointer"
	role="button"
	tabindex={0}
	onclick={handleCardClick}
	onkeydown={handleKeyDown}
>
	<!-- Thumbnail area -->
	<div class="aspect-video bg-slate-100 rounded-t-lg overflow-hidden relative">
		{#if thumbnailUrl}
			<img
				src={thumbnailUrl}
				alt="{project.name} floorplan"
				class="w-full h-full object-cover"
			/>
		{:else}
			<div class="w-full h-full flex items-center justify-center">
				<House class="size-12 text-slate-300" />
			</div>
		{/if}

		<!-- Member count badge -->
		{#if showMemberBadge}
			<div class="absolute top-2 left-2 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium text-slate-700">
				<Users class="size-3" />
				<span>{project.memberCount}</span>
			</div>
		{/if}

		<!-- Overflow menu -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onclick={stopPropagation} onkeydown={stopPropagation}>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button {...props} variant="secondary" size="icon" class="h-8 w-8 bg-white/90 backdrop-blur-sm hover:bg-white">
							<MoreVertical class="size-4" />
							<span class="sr-only">Actions</span>
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end" class="w-48">
					<DropdownMenu.Item onclick={() => onOpen(project.id)}>
						Open
					</DropdownMenu.Item>

					{#if project.isLocal}
						<Tooltip.Root>
							<Tooltip.Trigger class="w-full">
								<DropdownMenu.Item disabled class="w-full">
									<Share2 class="size-4" />
									Share
								</DropdownMenu.Item>
							</Tooltip.Trigger>
							<Tooltip.Content side="left">
								<p>Sync to cloud to share</p>
							</Tooltip.Content>
						</Tooltip.Root>
					{:else}
						<DropdownMenu.Item onclick={() => onShare(project.id)}>
							<Share2 class="size-4" />
							Share
						</DropdownMenu.Item>
					{/if}

					{#if project.isLocal && isAuthenticated()}
						<DropdownMenu.Item onclick={() => onSync(project.id)}>
							<Upload class="size-4" />
							Sync to cloud
						</DropdownMenu.Item>
					{/if}

					<DropdownMenu.Item onclick={() => onExport(project.id)}>
						<Download class="size-4" />
						Export JSON
					</DropdownMenu.Item>

					<DropdownMenu.Separator />

					<DropdownMenu.Item variant="destructive" onclick={() => onDelete(project.id)}>
						<Trash2 class="size-4" />
						Delete
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	</div>

	<!-- Card content -->
	<div class="p-3">
		<div class="flex items-start justify-between gap-2">
			<h3 class="font-medium text-slate-800 truncate flex-1" title={project.name}>
				{project.name}
			</h3>

			<!-- Storage indicator -->
			{#if project.isLocal}
				<Tooltip.Root>
					<Tooltip.Trigger>
						<HardDrive class="size-4 text-amber-500 flex-shrink-0" />
					</Tooltip.Trigger>
					<Tooltip.Content>
						<p>Stored locally</p>
					</Tooltip.Content>
				</Tooltip.Root>
			{:else}
				<Tooltip.Root>
					<Tooltip.Trigger>
						<Cloud class="size-4 text-blue-500 flex-shrink-0" />
					</Tooltip.Trigger>
					<Tooltip.Content>
						<p>Synced to cloud</p>
					</Tooltip.Content>
				</Tooltip.Root>
			{/if}
		</div>

		<p class="text-sm text-slate-500 mt-1">
			{relativeTime}
		</p>
	</div>
</div>
