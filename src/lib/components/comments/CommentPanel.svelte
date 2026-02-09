<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import CommentThread from './CommentThread.svelte';
	import {
		getActiveComment,
		setActiveComment,
		getPendingComment
	} from '$lib/stores/comments.svelte';

	interface Props {
		projectId: string;
		canEdit: boolean;
		isMobile: boolean;
		onSubmitPending?: (body: string) => void | Promise<void>;
		onCancelPending?: () => void;
	}

	let { projectId, canEdit, isMobile, onSubmitPending, onCancelPending }: Props = $props();

	const activeComment = $derived(getActiveComment());
	const pendingComment = $derived(getPendingComment());
	const open = $derived(activeComment !== null || pendingComment !== null);

	let pendingText = $state('');
	let pendingSubmitting = $state(false);

	function handleClose() {
		if (pendingComment) {
			onCancelPending?.();
		} else {
			setActiveComment(null);
		}
	}

	async function handleSubmitPending() {
		if (!pendingText.trim() || pendingSubmitting) return;
		pendingSubmitting = true;
		try {
			await onSubmitPending?.(pendingText.trim());
			pendingText = '';
		} finally {
			pendingSubmitting = false;
		}
	}

	function handlePendingKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmitPending();
		}
	}
</script>

{#snippet pendingInput()}
	<div class="flex flex-col gap-2">
		<span class="text-xs text-slate-400">Type your comment:</span>
		<div class="flex gap-2">
			<Input
				bind:value={pendingText}
				placeholder="Add a comment..."
				class="flex-1 h-8 text-sm"
				onkeydown={handlePendingKeydown}
				autofocus
			/>
			<Button
				size="sm"
				class="h-8"
				disabled={!pendingText.trim() || pendingSubmitting}
				onclick={handleSubmitPending}
			>
				Post
			</Button>
		</div>
	</div>
{/snippet}

{#if isMobile}
	<!-- Mobile: Bottom Sheet -->
	<Sheet.Root {open} onOpenChange={(v) => { if (!v) handleClose(); }}>
		<Sheet.Content side="bottom" class="max-h-[70vh] rounded-t-xl px-4 pb-4" style="padding-bottom: env(safe-area-inset-bottom);">
			<Sheet.Header class="pb-2">
				<Sheet.Title class="text-sm">{pendingComment ? 'New Comment' : 'Comment'}</Sheet.Title>
			</Sheet.Header>
			{#if pendingComment}
				{@render pendingInput()}
			{:else if activeComment}
				<CommentThread comment={activeComment} {projectId} {canEdit} />
			{/if}
		</Sheet.Content>
	</Sheet.Root>
{:else}
	<!-- Desktop: Side panel -->
	{#if open}
		<div class="w-72 border-l border-slate-200 bg-white p-4 flex flex-col gap-3 overflow-y-auto">
			<div class="flex items-center justify-between">
				<span class="text-sm font-medium text-slate-700">{pendingComment ? 'New Comment' : 'Comment'}</span>
				<Button variant="ghost" size="sm" class="h-6 w-6 p-0" onclick={handleClose}>
					✕
				</Button>
			</div>
			{#if pendingComment}
				{@render pendingInput()}
			{:else if activeComment}
				<CommentThread comment={activeComment} {projectId} {canEdit} />
			{/if}
		</div>
	{/if}
{/if}
