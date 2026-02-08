<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet';
	import { Button } from '$lib/components/ui/button';
	import CommentThread from './CommentThread.svelte';
	import {
		getActiveComment,
		setActiveComment
	} from '$lib/stores/comments.svelte';

	interface Props {
		projectId: string;
		canEdit: boolean;
		isMobile: boolean;
	}

	let { projectId, canEdit, isMobile }: Props = $props();

	const activeComment = $derived(getActiveComment());
	const open = $derived(activeComment !== null);

	function handleClose() {
		setActiveComment(null);
	}
</script>

{#if isMobile}
	<!-- Mobile: Bottom Sheet -->
	<Sheet.Root {open} onOpenChange={(v) => { if (!v) handleClose(); }}>
		<Sheet.Content side="bottom" class="max-h-[70vh] rounded-t-xl px-4 pb-4" style="padding-bottom: env(safe-area-inset-bottom);">
			<Sheet.Header class="pb-2">
				<Sheet.Title class="text-sm">Comment</Sheet.Title>
			</Sheet.Header>
			{#if activeComment}
				<CommentThread comment={activeComment} {projectId} {canEdit} />
			{/if}
		</Sheet.Content>
	</Sheet.Root>
{:else}
	<!-- Desktop: Side panel -->
	{#if activeComment}
		<div class="w-72 border-l border-slate-200 bg-white p-4 flex flex-col gap-3 overflow-y-auto">
			<div class="flex items-center justify-between">
				<span class="text-sm font-medium text-slate-700">Comment</span>
				<Button variant="ghost" size="sm" class="h-6 w-6 p-0" onclick={handleClose}>
					✕
				</Button>
			</div>
			<CommentThread comment={activeComment} {projectId} {canEdit} />
		</div>
	{/if}
{/if}
