<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
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
	}

	let { comment, projectId, canEdit }: Props = $props();

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
		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		const diffHrs = Math.floor(diffMins / 60);
		if (diffHrs < 24) return `${diffHrs}h ago`;
		const diffDays = Math.floor(diffHrs / 24);
		return `${diffDays}d ago`;
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
		<span class="text-xs text-slate-400 uppercase tracking-wide">
			{comment.type === 'canvas' ? 'Pin comment' : 'Item comment'}
		</span>
		{#if canEdit}
			<div class="flex items-center gap-1">
				<Button
					variant="ghost"
					size="sm"
					class="h-6 text-xs {comment.resolved ? 'text-green-600' : 'text-slate-500'}"
					onclick={() => toggleResolve(projectId, comment.id)}
				>
					{comment.resolved ? 'Resolved' : 'Resolve'}
				</Button>
				<Button
					variant="ghost"
					size="sm"
					class="h-6 text-xs text-red-500 hover:text-red-700"
					onclick={() => removeComment(projectId, comment.id)}
				>
					Delete
				</Button>
			</div>
		{/if}
	</div>

	<!-- Replies -->
	<div class="flex flex-col gap-2 max-h-[40vh] overflow-y-auto">
		{#each comment.replies as reply (reply.id)}
			<div class="flex gap-2">
				<div
					class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-medium flex-shrink-0"
				>
					{getInitial(reply.authorName)}
				</div>
				<div class="flex-1 min-w-0">
					<div class="flex items-baseline gap-2">
						<span class="text-sm font-medium text-slate-700 truncate">
							{reply.authorName ?? 'Unknown'}
						</span>
						<span class="text-xs text-slate-400">{formatTime(reply.createdAt)}</span>
					</div>
					<p class="text-sm text-slate-600 whitespace-pre-wrap break-words">{reply.body}</p>
				</div>
			</div>
		{/each}
	</div>

	<!-- Reply input -->
	{#if canEdit}
		<div class="flex gap-2">
			<Input
				bind:value={replyText}
				placeholder="Reply..."
				class="flex-1 h-8 text-sm"
				onkeydown={handleKeydown}
			/>
			<Button
				size="sm"
				class="h-8"
				disabled={!replyText.trim() || submitting}
				onclick={handleSubmitReply}
			>
				Send
			</Button>
		</div>
	{/if}
</div>
