// Client-side types (no server imports)
export interface ClientComment {
	id: string;
	projectId: string;
	branchId: string;
	authorId: string;
	authorName: string | null;
	authorAvatarUrl: string | null;
	type: 'canvas' | 'item';
	itemId: string | null;
	x: number | null;
	y: number | null;
	resolved: boolean;
	createdAt: string | null;
	updatedAt: string | null;
	replies: ClientReply[];
}

export interface ClientReply {
	id: string;
	commentId: string;
	authorId: string;
	authorName: string | null;
	authorAvatarUrl: string | null;
	body: string;
	createdAt: string | null;
}

interface CommentsState {
	comments: ClientComment[];
	loading: boolean;
	visible: boolean;
	showResolved: boolean;
	activeCommentId: string | null;
	placementMode: boolean;
}

let state = $state<CommentsState>({
	comments: [],
	loading: false,
	visible: true,
	showResolved: false,
	activeCommentId: null,
	placementMode: false
});

// --- Getters ---

export function getComments(): ClientComment[] {
	return state.comments;
}

export function getCanvasComments(): ClientComment[] {
	return state.comments.filter(
		(c) => c.type === 'canvas' && (state.showResolved || !c.resolved)
	);
}

export function getItemComments(itemId: string): ClientComment[] {
	return state.comments.filter(
		(c) => c.type === 'item' && c.itemId === itemId && (state.showResolved || !c.resolved)
	);
}

export function getItemCommentCount(itemId: string): number {
	return state.comments.filter(
		(c) => c.type === 'item' && c.itemId === itemId && !c.resolved
	).length;
}

export function getActiveComment(): ClientComment | null {
	if (!state.activeCommentId) return null;
	return state.comments.find((c) => c.id === state.activeCommentId) ?? null;
}

export function isCommentsVisible(): boolean {
	return state.visible;
}

export function isPlacementMode(): boolean {
	return state.placementMode;
}

export function isShowResolved(): boolean {
	return state.showResolved;
}

export function isCommentsLoading(): boolean {
	return state.loading;
}

// --- Setters ---

export function setActiveComment(id: string | null): void {
	state.activeCommentId = id;
}

export function toggleCommentsVisibility(): void {
	state.visible = !state.visible;
}

export function toggleShowResolved(): void {
	state.showResolved = !state.showResolved;
}

export function enterPlacementMode(): void {
	state.placementMode = true;
}

export function exitPlacementMode(): void {
	state.placementMode = false;
}

// --- API calls ---

export async function loadComments(projectId: string, branchId: string): Promise<void> {
	state.loading = true;
	try {
		const res = await fetch(
			`/api/projects/${projectId}/comments?branchId=${encodeURIComponent(branchId)}`
		);
		if (!res.ok) {
			console.error('Failed to load comments:', res.status);
			return;
		}
		const data = await res.json();
		state.comments = data.comments;
	} catch (err) {
		console.error('Failed to load comments:', err);
	} finally {
		state.loading = false;
	}
}

export async function createCanvasComment(
	projectId: string,
	branchId: string,
	x: number,
	y: number,
	body: string
): Promise<ClientComment | null> {
	try {
		const res = await fetch(`/api/projects/${projectId}/comments`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'canvas', branchId, x, y, body })
		});
		if (!res.ok) {
			console.error('Failed to create canvas comment:', res.status);
			return null;
		}
		const data = await res.json();
		const comment: ClientComment = data.comment;
		state.comments = [...state.comments, comment];
		state.activeCommentId = comment.id;
		state.placementMode = false;
		return comment;
	} catch (err) {
		console.error('Failed to create canvas comment:', err);
		return null;
	}
}

export async function createItemComment(
	projectId: string,
	branchId: string,
	itemId: string,
	body: string
): Promise<ClientComment | null> {
	try {
		const res = await fetch(`/api/projects/${projectId}/comments`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'item', branchId, itemId, body })
		});
		if (!res.ok) {
			console.error('Failed to create item comment:', res.status);
			return null;
		}
		const data = await res.json();
		const comment: ClientComment = data.comment;
		state.comments = [...state.comments, comment];
		state.activeCommentId = comment.id;
		return comment;
	} catch (err) {
		console.error('Failed to create item comment:', err);
		return null;
	}
}

export async function addReplyToComment(
	projectId: string,
	commentId: string,
	body: string
): Promise<ClientReply | null> {
	try {
		const res = await fetch(`/api/projects/${projectId}/comments/${commentId}/replies`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ body })
		});
		if (!res.ok) {
			console.error('Failed to add reply:', res.status);
			return null;
		}
		const data = await res.json();
		const reply: ClientReply = data.reply;
		state.comments = state.comments.map((c) =>
			c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c
		);
		return reply;
	} catch (err) {
		console.error('Failed to add reply:', err);
		return null;
	}
}

export async function toggleResolve(projectId: string, commentId: string): Promise<void> {
	const comment = state.comments.find((c) => c.id === commentId);
	if (!comment) return;

	const previousResolved = comment.resolved;
	// Optimistic update
	state.comments = state.comments.map((c) =>
		c.id === commentId ? { ...c, resolved: !previousResolved } : c
	);

	try {
		const res = await fetch(`/api/projects/${projectId}/comments/${commentId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ resolved: !previousResolved })
		});
		if (!res.ok) {
			// Revert on failure
			state.comments = state.comments.map((c) =>
				c.id === commentId ? { ...c, resolved: previousResolved } : c
			);
			console.error('Failed to toggle resolve:', res.status);
		}
	} catch (err) {
		// Revert on failure
		state.comments = state.comments.map((c) =>
			c.id === commentId ? { ...c, resolved: previousResolved } : c
		);
		console.error('Failed to toggle resolve:', err);
	}
}

export async function removeComment(projectId: string, commentId: string): Promise<void> {
	const previous = state.comments;
	// Optimistic update
	state.comments = state.comments.filter((c) => c.id !== commentId);
	if (state.activeCommentId === commentId) {
		state.activeCommentId = null;
	}

	try {
		const res = await fetch(`/api/projects/${projectId}/comments/${commentId}`, {
			method: 'DELETE'
		});
		if (!res.ok) {
			// Revert on failure
			state.comments = previous;
			console.error('Failed to delete comment:', res.status);
		}
	} catch (err) {
		// Revert on failure
		state.comments = previous;
		console.error('Failed to delete comment:', err);
	}
}

// --- WebSocket handlers ---

export function handleRemoteCommentCreated(comment: ClientComment): void {
	if (state.comments.some((c) => c.id === comment.id)) return;
	state.comments = [...state.comments, comment];
}

export function handleRemoteReplyCreated(commentId: string, reply: ClientReply): void {
	state.comments = state.comments.map((c) => {
		if (c.id !== commentId) return c;
		if (c.replies.some((r) => r.id === reply.id)) return c;
		return { ...c, replies: [...c.replies, reply] };
	});
}

export function handleRemoteCommentResolved(commentId: string, resolved: boolean): void {
	state.comments = state.comments.map((c) =>
		c.id === commentId ? { ...c, resolved } : c
	);
}

export function handleRemoteCommentDeleted(commentId: string): void {
	state.comments = state.comments.filter((c) => c.id !== commentId);
	if (state.activeCommentId === commentId) {
		state.activeCommentId = null;
	}
}

// --- Cleanup ---

export function resetComments(): void {
	state.comments = [];
	state.loading = false;
	state.visible = true;
	state.showResolved = false;
	state.activeCommentId = null;
	state.placementMode = false;
}
