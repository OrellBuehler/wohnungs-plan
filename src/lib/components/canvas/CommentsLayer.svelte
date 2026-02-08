<script lang="ts">
	import { Group, Circle, Text } from 'svelte-konva';
	import {
		getCanvasComments,
		isCommentsVisible,
		setActiveComment,
		isPlacementMode,
		type ClientComment
	} from '$lib/stores/comments.svelte';

	interface Props {
		isMobile: boolean;
	}

	let { isMobile }: Props = $props();

	const comments = $derived(getCanvasComments());
	const visible = $derived(isCommentsVisible());
	const pinSize = $derived(isMobile ? 16 : 12);

	function handlePinClick(comment: ClientComment) {
		if (isPlacementMode()) return;
		setActiveComment(comment.id);
	}

	function getInitial(name: string | null): string {
		return name?.charAt(0)?.toUpperCase() ?? '?';
	}
</script>

{#if visible}
	<Group id="comments-layer" listening={true}>
		{#each comments as comment (comment.id)}
			{#if comment.x != null && comment.y != null}
				<Group
					x={comment.x}
					y={comment.y}
					listening={true}
					on:click={() => handlePinClick(comment)}
					on:tap={() => handlePinClick(comment)}
				>
					<Circle
						x={0}
						y={0}
						radius={pinSize}
						fill={comment.resolved ? '#94a3b8' : '#6366f1'}
						stroke="#fff"
						strokeWidth={2}
						opacity={comment.resolved ? 0.5 : 0.9}
					/>
					<Text
						x={-pinSize / 2}
						y={-pinSize / 2}
						width={pinSize}
						height={pinSize}
						text={getInitial(comment.authorName)}
						fontSize={pinSize * 0.8}
						fill="#fff"
						fontStyle="bold"
						align="center"
						verticalAlign="middle"
						listening={false}
					/>
				</Group>
			{/if}
		{/each}
	</Group>
{/if}
