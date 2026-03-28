<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as m from '$lib/paraglide/messages';
	import CommentThread from './CommentThread.svelte';
	import {
		getActiveComment,
		setActiveComment,
		getPendingComment,
		getComments,
		isShowResolved,
		toggleShowResolved,
		isCommentsVisible,
		toggleCommentsVisibility,
		type ClientComment
	} from '$lib/stores/comments.svelte';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import X from '@lucide/svelte/icons/x';
	import MessageCircle from '@lucide/svelte/icons/message-circle';

	interface Props {
		projectId: string;
		canEdit: boolean;
		isMobile: boolean;
		open: boolean;
		branchId: string | null;
		onSubmitPending?: (body: string) => void | Promise<void>;
		onCancelPending?: () => void;
		onClose?: () => void;
		onPlaceOnMap?: () => void;
		onCreateComment?: (body: string) => void | Promise<void>;
		onPinCommentToMap?: (commentId: string) => void;
	}

	let {
		projectId,
		canEdit,
		isMobile,
		open,
		branchId,
		onSubmitPending,
		onCancelPending,
		onClose,
		onPlaceOnMap,
		onCreateComment,
		onPinCommentToMap
	}: Props = $props();

	const activeComment = $derived(getActiveComment());
	const pendingComment = $derived(getPendingComment());
	const allComments = $derived(getComments());
	const showResolved = $derived(isShowResolved());
	const commentsVisible = $derived(isCommentsVisible());

	const filteredComments = $derived.by(() => {
		const sorted = [...allComments].sort((a, b) => {
			// Unresolved first
			if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
			// Newest first
			const aTime = a.updatedAt ?? a.createdAt ?? '';
			const bTime = b.updatedAt ?? b.createdAt ?? '';
			return bTime.localeCompare(aTime);
		});
		if (showResolved) return sorted;
		return sorted.filter((c) => !c.resolved);
	});

	// Determine which mode we're in
	const isDetailMode = $derived(activeComment !== null || pendingComment !== null);

	let pendingText = $state('');
	let pendingSubmitting = $state(false);
	let newCommentText = $state('');
	let newCommentSubmitting = $state(false);

	function handleClose() {
		if (pendingComment) {
			onCancelPending?.();
		} else if (activeComment) {
			setActiveComment(null);
		} else {
			onClose?.();
		}
	}

	function handleBack() {
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

	async function handleNewComment() {
		if (!newCommentText.trim() || newCommentSubmitting) return;
		newCommentSubmitting = true;
		try {
			await onCreateComment?.(newCommentText.trim());
			newCommentText = '';
		} finally {
			newCommentSubmitting = false;
		}
	}

	function handleNewCommentKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleNewComment();
		}
	}

	function handleCommentClick(comment: ClientComment) {
		setActiveComment(comment.id);
	}

	function getInitial(name: string | null): string {
		return name?.charAt(0)?.toUpperCase() ?? '?';
	}

	function formatTime(dateStr: string | null): string {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		if (diffMins < 1) return m.time_just_now();
		if (diffMins < 60) return m.time_minutes_ago({ count: diffMins.toString() });
		const diffHrs = Math.floor(diffMins / 60);
		if (diffHrs < 24) return m.time_hours_ago({ count: diffHrs.toString() });
		const diffDays = Math.floor(diffHrs / 24);
		return m.time_days_ago({ count: diffDays.toString() });
	}

	function getPreviewText(comment: ClientComment): string {
		const lastReply = comment.replies[comment.replies.length - 1];
		return lastReply?.body ?? m.comments_panel_no_messages();
	}
</script>

{#snippet pendingInput()}
	<div class="flex flex-col gap-2">
		<span class="text-xs text-slate-400">{m.comments_panel_type_label()}</span>
		<div class="flex flex-col gap-2">
			<textarea
				bind:value={pendingText}
				placeholder={m.comments_panel_placeholder()}
				class="flex-1 min-h-[60px] max-h-32 resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-0"
				onkeydown={handlePendingKeydown}
				autofocus
			></textarea>
			<Button
				size="sm"
				class="h-8 self-end"
				disabled={!pendingText.trim() || pendingSubmitting}
				onclick={handleSubmitPending}
			>
				{m.common_post()}
			</Button>
		</div>
	</div>
{/snippet}

{#snippet listView()}
	<div class="flex flex-col gap-3 h-full">
		<!-- New comment input -->
		{#if canEdit}
			<div class="flex flex-col gap-2">
				<textarea
					bind:value={newCommentText}
					placeholder={m.comments_panel_new_placeholder()}
					class="min-h-[60px] max-h-32 resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-0"
					onkeydown={handleNewCommentKeydown}
				></textarea>
				<div class="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						class="flex-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
						onclick={() => onPlaceOnMap?.()}
					>
						<svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
							/>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
							/>
						</svg>
						{m.comments_panel_pin()}
					</Button>
					<Button
						size="sm"
						class="h-8"
						disabled={!newCommentText.trim() || newCommentSubmitting}
						onclick={handleNewComment}
					>
						{m.common_post()}
					</Button>
				</div>
			</div>
		{/if}

		<!-- Toggle resolved -->
		<button
			type="button"
			class="text-xs text-slate-400 hover:text-slate-600 text-left"
			onclick={toggleShowResolved}
		>
			{showResolved ? m.comments_panel_hide_resolved() : m.comments_panel_show_resolved()}
		</button>

		<!-- Comment list -->
		<div class="flex-1 overflow-y-auto space-y-1.5 min-h-0">
			{#if filteredComments.length === 0}
				<div class="flex flex-col items-center justify-center py-8 text-center">
					<MessageCircle class="size-8 text-slate-300 mb-2" />
					<p class="text-sm text-slate-400">{m.comments_panel_empty()}</p>
				</div>
			{:else}
				{#each filteredComments as comment (comment.id)}
					<button
						type="button"
						class="w-full text-left p-2 rounded-md hover:bg-slate-50 transition-colors {comment.resolved
							? 'opacity-60'
							: ''}"
						onclick={() => handleCommentClick(comment)}
					>
						<div class="flex items-start gap-2">
							<div
								class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 {comment.resolved
									? 'bg-slate-100 text-slate-500'
									: 'bg-indigo-100 text-indigo-700'}"
							>
								{getInitial(comment.authorName)}
							</div>
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-1.5">
									<span class="text-sm font-medium text-slate-700 truncate">
										{comment.authorName ?? m.comments_thread_unknown()}
									</span>
									<span class="text-xs text-slate-400 flex-shrink-0"
										>{formatTime(comment.updatedAt ?? comment.createdAt)}</span
									>
								</div>
								<p class="text-xs text-slate-500 truncate">{getPreviewText(comment)}</p>
								<div class="flex items-center gap-1.5 mt-0.5">
									{#if comment.x != null && comment.y != null}
										<span class="text-[10px] px-1 py-0.5 rounded bg-indigo-50 text-indigo-500"
											>pinned</span
										>
									{/if}
									{#if comment.resolved}
										<span class="text-[10px] px-1 py-0.5 rounded bg-green-50 text-green-600"
											>resolved</span
										>
									{/if}
									{#if comment.replies.length > 0}
										<span class="text-[10px] text-slate-400"
											>{m.comments_thread_reply_count({
												count: comment.replies.length.toString()
											})}</span
										>
									{/if}
								</div>
							</div>
						</div>
					</button>
				{/each}
			{/if}
		</div>
	</div>
{/snippet}

{#snippet detailView()}
	{#if pendingComment}
		{@render pendingInput()}
	{:else if activeComment}
		<CommentThread comment={activeComment} {projectId} {canEdit} onPinToMap={onPinCommentToMap} />
	{/if}
{/snippet}

{#if open}
	<div
		class="{isMobile
			? 'w-full flex-1'
			: 'w-72 flex-shrink-0 border-l border-slate-200 h-full'} bg-white p-4 flex flex-col gap-3 overflow-hidden"
	>
		<!-- Header -->
		<div class="flex items-center justify-between flex-shrink-0">
			{#if isDetailMode}
				<button
					type="button"
					class="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
					onclick={handleBack}
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 19l-7-7 7-7"
						/>
					</svg>
					{m.common_back()}
				</button>
				<span class="text-sm font-medium text-slate-700">
					{pendingComment ? m.comments_panel_new_header() : m.comments_panel_comment_header()}
				</span>
			{:else}
				<span class="text-sm font-medium text-slate-700">{m.comments_panel_title()}</span>
			{/if}
			<div class="flex items-center gap-1">
				<Button
					variant="ghost"
					size="sm"
					class="h-7 w-7 p-0 {commentsVisible ? 'text-slate-500' : 'text-slate-300'}"
					title={commentsVisible ? m.comments_panel_hide_pins() : m.comments_panel_show_pins()}
					onclick={toggleCommentsVisibility}
				>
					{#if commentsVisible}
						<Eye class="h-4 w-4" />
					{:else}
						<EyeOff class="h-4 w-4" />
					{/if}
				</Button>
				{#if !isMobile}
					<Button variant="ghost" size="sm" class="h-6 w-6 p-0" onclick={handleClose}>
						<X class="h-4 w-4" />
					</Button>
				{/if}
			</div>
		</div>

		<!-- Content -->
		<div class="flex-1 min-h-0 overflow-y-auto">
			{#if isDetailMode}
				{@render detailView()}
			{:else}
				{@render listView()}
			{/if}
		</div>
	</div>
{/if}
