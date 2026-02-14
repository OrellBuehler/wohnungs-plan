import {
	sendCommentCreated,
	sendReplyCreated,
	sendCommentResolved,
	sendCommentDeleted
} from './collaboration.svelte';

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

export interface PendingComment {
	x: number;
	y: number;
}

interface CommentsState {
	comments: ClientComment[];
	loading: boolean;
	visible: boolean;
	showResolved: boolean;
	activeCommentId: string | null;
	placementMode: boolean;
	pinningCommentId: string | null;
	lastSeenAt: string | null;
	pendingComment: PendingComment | null;
}

let currentProjectId: string | null = null;

let state = $state<CommentsState>({
	comments: [],
	loading: false,
	visible: true,
	showResolved: false,
	activeCommentId: null,
	placementMode: false,
	pinningCommentId: null,
	lastSeenAt: null,
	pendingComment: null
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

export function getUnreadCount(): number {
	if (!state.lastSeenAt) return state.comments.length;
	return state.comments.filter(
		(c) => c.updatedAt && c.updatedAt > state.lastSeenAt!
	).length;
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

export function enterPlacementMode(commentId?: string): void {
	state.placementMode = true;
	state.pinningCommentId = commentId ?? null;
	state.activeCommentId = null;
}

export function exitPlacementMode(): void {
	state.placementMode = false;
	state.pinningCommentId = null;
	state.pendingComment = null;
}

export function getPinningCommentId(): string | null {
	return state.pinningCommentId;
}

export function getPendingComment(): PendingComment | null {
	return state.pendingComment;
}

export function setPendingComment(coords: PendingComment | null): void {
	state.pendingComment = coords;
	if (coords) {
		state.placementMode = false;
	}
}

export function markAllRead(): void {
	state.lastSeenAt = new Date().toISOString();
	if (currentProjectId) {
		try {
			localStorage.setItem(`comments-seen-${currentProjectId}`, state.lastSeenAt);
		} catch {}
	}
}

// --- API calls ---

export async function loadComments(projectId: string, branchId: string): Promise<void> {
	currentProjectId = projectId;
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
		try {
			state.lastSeenAt = localStorage.getItem(`comments-seen-${projectId}`) ?? null;
		} catch {}
	} catch (err) {
		console.error('Failed to load comments:', err);
	} finally {
		state.loading = false;
	}
}

export async function createComment(
	projectId: string,
	branchId: string,
	body: string,
	position?: { x: number; y: number }
): Promise<ClientComment | null> {
	try {
		const res = await fetch(`/api/projects/${projectId}/comments`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'canvas', branchId, body, ...position })
		});
		if (!res.ok) {
			console.error('Failed to create comment:', res.status);
			return null;
		}
		const data = await res.json();
		const comment: ClientComment = data.comment;
		state.comments = [...state.comments, comment];
		state.activeCommentId = comment.id;
		if (position) state.placementMode = false;
		sendCommentCreated(data.comment);
		return comment;
	} catch (err) {
		console.error('Failed to create comment:', err);
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
		const now = new Date().toISOString();
		state.comments = state.comments.map((c) =>
			c.id === commentId ? { ...c, replies: [...c.replies, reply], updatedAt: now } : c
		);
		sendReplyCreated(commentId, data.reply);
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
	const newResolved = !previousResolved;
	// Optimistic update
	state.comments = state.comments.map((c) =>
		c.id === commentId ? { ...c, resolved: newResolved } : c
	);

	try {
		const res = await fetch(`/api/projects/${projectId}/comments/${commentId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ resolved: newResolved })
		});
		if (!res.ok) {
			state.comments = state.comments.map((c) =>
				c.id === commentId ? { ...c, resolved: previousResolved } : c
			);
			console.error('Failed to toggle resolve:', res.status);
			return;
		}
		sendCommentResolved(commentId, newResolved);
	} catch (err) {
		state.comments = state.comments.map((c) =>
			c.id === commentId ? { ...c, resolved: previousResolved } : c
		);
		console.error('Failed to toggle resolve:', err);
	}
}

export async function updateCommentPosition(
	projectId: string,
	commentId: string,
	x: number,
	y: number
): Promise<boolean> {
	// Optimistic update
	const previous = state.comments;
	state.comments = state.comments.map((c) =>
		c.id === commentId ? { ...c, x, y } : c
	);

	try {
		const res = await fetch(`/api/projects/${projectId}/comments/${commentId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ x, y })
		});
		if (!res.ok) {
			state.comments = previous;
			console.error('Failed to update comment position:', res.status);
			return false;
		}
		return true;
	} catch (err) {
		state.comments = previous;
		console.error('Failed to update comment position:', err);
		return false;
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
			state.comments = previous;
			console.error('Failed to delete comment:', res.status);
			return;
		}
		sendCommentDeleted(commentId);
	} catch (err) {
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
	state.pinningCommentId = null;
	state.lastSeenAt = null;
	state.pendingComment = null;
	currentProjectId = null;
}
