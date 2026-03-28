<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as m from '$lib/paraglide/messages';
	import {
		addReplyToComment,
		toggleResolve,
		removeComment,
		type ClientComment
	} from '$lib/stores/comments.svelte';

	interface Props {
		comment: ClientComment;
		projectId: string;
		canEdit: boolean;
		onPinToMap?: (commentId: string) => void;
	}

	let { comment, projectId, canEdit, onPinToMap }: Props = $props();

	const isPinned = $derived(comment.x != null && comment.y != null);

	let replyText = $state('');
	let submitting = $state(false);

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

	async function handleSubmitReply() {
		if (!replyText.trim() || submitting) return;
		submitting = true;
		await addReplyToComment(projectId, comment.id, replyText.trim());
		replyText = '';
		submitting = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmitReply();
		}
	}
</script>

<div class="flex flex-col gap-3">
	<!-- Header -->
	<div class="flex items-center justify-between">
		{#if isPinned}
			<span class="text-xs text-outline uppercase tracking-wide">
				{comment.type === 'canvas' ? m.comments_thread_pinned() : m.comments_thread_item_comment()}
			</span>
		{:else if canEdit && onPinToMap}
			<Button
				variant="outline"
				size="sm"
				class="h-6 text-xs text-secondary border-secondary/30 hover:bg-secondary-fixed"
				onclick={() => onPinToMap?.(comment.id)}
			>
				<svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
				{m.comments_thread_pin()}
			</Button>
		{:else}
			<span class="text-xs text-outline uppercase tracking-wide"
				>{m.comments_thread_header()}</span
			>
		{/if}
		{#if canEdit}
			<div class="flex items-center gap-1">
				<Button
					variant="ghost"
					size="sm"
					class="h-6 text-xs {comment.resolved ? 'text-secondary' : 'text-on-surface-variant'}"
					onclick={() => toggleResolve(projectId, comment.id)}
				>
					{comment.resolved ? m.comments_thread_resolved() : m.comments_thread_resolve()}
				</Button>
				<Button
					variant="ghost"
					size="sm"
					class="h-6 text-xs text-destructive hover:text-destructive/80"
					onclick={() => removeComment(projectId, comment.id)}
				>
					{m.common_delete()}
				</Button>
			</div>
		{/if}
	</div>

	<!-- Replies -->
	<div class="flex flex-col gap-2 max-h-[40vh] overflow-y-auto">
		{#each comment.replies as reply (reply.id)}
			<div class="flex gap-2">
				<div
					class="w-6 h-6 rounded-xl bg-secondary-fixed text-secondary flex items-center justify-center text-xs font-medium flex-shrink-0"
				>
					{getInitial(reply.authorName)}
				</div>
				<div class="flex-1 min-w-0">
					<div class="flex items-baseline gap-2">
						<span class="text-sm font-medium text-on-surface truncate">
							{reply.authorName ?? m.comments_thread_unknown()}
						</span>
						<span class="text-xs text-outline">{formatTime(reply.createdAt)}</span>
					</div>
					<p class="text-sm text-on-surface-variant whitespace-pre-wrap break-words">{reply.body}</p>
				</div>
			</div>
		{/each}
	</div>

	<!-- Reply input -->
	{#if canEdit}
		<div class="flex flex-col gap-2">
			<textarea
				bind:value={replyText}
				placeholder={m.comments_thread_reply_placeholder()}
				class="min-h-[48px] max-h-32 resize-y rounded-md border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-outline focus:ring-offset-0"
				onkeydown={handleKeydown}
			></textarea>
			<Button
				size="sm"
				class="h-8 self-end"
				disabled={!replyText.trim() || submitting}
				onclick={handleSubmitReply}
			>
				{m.common_send()}
			</Button>
		</div>
	{/if}
</div>
