import { isAuthenticated } from './auth.svelte';
import {
	handleRemoteCommentCreated,
	handleRemoteReplyCreated,
	handleRemoteCommentResolved,
	handleRemoteCommentDeleted
} from './comments.svelte';

interface RemoteUser {
	id: string;
	name: string | null;
	avatarUrl: string | null;
	color: string;
}

interface Cursor {
	x: number;
	y: number;
}

interface CollaborationState {
	isConnected: boolean;
	myColor: string | null;
	users: RemoteUser[];
	cursors: Map<string, Cursor>;
	lockedItems: Map<string, string>; // itemId -> userId
	selectedItems: Map<string, string>; // itemId -> userId
}

let state = $state<CollaborationState>({
	isConnected: false,
	myColor: null,
	users: [],
	cursors: new Map(),
	lockedItems: new Map(),
	selectedItems: new Map()
});

let ws: WebSocket | null = null;
let currentRoomKey: string | null = null;
let cursorThrottleTimeout: ReturnType<typeof setTimeout> | null = null;

const CURSOR_THROTTLE_MS = 50;

export function getCollaborationState(): CollaborationState {
	return state;
}

export function getRemoteUsers(): RemoteUser[] {
	return state.users;
}

export function getRemoteCursors(): Map<string, Cursor> {
	return state.cursors;
}

export function getLockedItems(): Map<string, string> {
	return state.lockedItems;
}

export function isItemLockedByOther(itemId: string, myUserId: string): boolean {
	const lockHolder = state.lockedItems.get(itemId);
	return lockHolder !== undefined && lockHolder !== myUserId;
}

export function getUserColor(userId: string): string | undefined {
	return state.users.find((u) => u.id === userId)?.color;
}

export function connect(projectId: string, branchId: string): void {
	if (!isAuthenticated()) return;
	const roomKey = `${projectId}:${branchId}`;
	if (ws && currentRoomKey === roomKey) return;

	disconnect();

	const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
	const url = `${protocol}//${window.location.host}/ws/projects/${projectId}/branches/${branchId}`;

	ws = new WebSocket(url);
	currentRoomKey = roomKey;

	ws.onopen = () => {
		state.isConnected = true;
	};

	ws.onclose = () => {
		state.isConnected = false;
		state.users = [];
		state.cursors = new Map();
		state.lockedItems = new Map();
		ws = null;
	};

	ws.onerror = (error) => {
		console.error('WebSocket error:', error);
	};

	ws.onmessage = (event) => {
		try {
			const msg = JSON.parse(event.data);
			handleMessage(msg);
		} catch (err) {
			console.error('Failed to parse WebSocket message:', err);
		}
	};
}

export function disconnect(): void {
	if (ws) {
		ws.close();
		ws = null;
	}
	currentRoomKey = null;
	state.isConnected = false;
	state.users = [];
	state.cursors = new Map();
	state.lockedItems = new Map();
}

function handleMessage(msg: unknown): void {
	const message = msg as Record<string, unknown>;

	switch (message.type) {
		case 'init':
			state.myColor = message.yourColor as string;
			state.users = (message.collaborators as RemoteUser[]) ?? [];
			break;

		case 'user_joined':
			state.users = [
				...state.users,
				{
					id: (message.user as RemoteUser).id,
					name: (message.user as RemoteUser).name,
					avatarUrl: (message.user as RemoteUser).avatarUrl,
					color: message.color as string
				}
			];
			break;

		case 'user_left':
			state.users = state.users.filter((u) => u.id !== message.userId);
			state.cursors.delete(message.userId as string);
			// Remove locks held by this user
			for (const [itemId, userId] of state.lockedItems) {
				if (userId === message.userId) {
					state.lockedItems.delete(itemId);
				}
			}
			break;

		case 'cursor_move':
			state.cursors.set(message.userId as string, {
				x: message.x as number,
				y: message.y as number
			});
			break;

		case 'item_locked':
			state.lockedItems.set(message.itemId as string, message.userId as string);
			break;

		case 'item_unlocked':
			state.lockedItems.delete(message.itemId as string);
			break;

		case 'comment_created':
			handleRemoteCommentCreated(message.comment as Parameters<typeof handleRemoteCommentCreated>[0]);
			break;
		case 'reply_created':
			handleRemoteReplyCreated(
				message.commentId as string,
				message.reply as Parameters<typeof handleRemoteReplyCreated>[1]
			);
			break;
		case 'comment_resolved':
			handleRemoteCommentResolved(message.commentId as string, message.resolved as boolean);
			break;
		case 'comment_deleted':
			handleRemoteCommentDeleted(message.commentId as string);
			break;
	}
}

export function sendCursorMove(x: number, y: number): void {
	if (!ws || ws.readyState !== WebSocket.OPEN) return;

	// Throttle cursor updates
	if (cursorThrottleTimeout) return;

	cursorThrottleTimeout = setTimeout(() => {
		cursorThrottleTimeout = null;
	}, CURSOR_THROTTLE_MS);

	ws.send(JSON.stringify({ type: 'cursor_move', x, y }));
}

export function sendLockItem(itemId: string): void {
	if (!ws || ws.readyState !== WebSocket.OPEN) return;
	ws.send(JSON.stringify({ type: 'lock_item', itemId }));
}

export function sendUnlockItem(): void {
	if (!ws || ws.readyState !== WebSocket.OPEN) return;
	ws.send(JSON.stringify({ type: 'unlock_item' }));
}

export function sendItemUpdated(item: unknown): void {
	if (!ws || ws.readyState !== WebSocket.OPEN) return;
	ws.send(JSON.stringify({ type: 'item_updated', item }));
}

export function sendItemCreated(item: unknown): void {
	if (!ws || ws.readyState !== WebSocket.OPEN) return;
	ws.send(JSON.stringify({ type: 'item_created', item }));
}

export function sendItemDeleted(itemId: string): void {
	if (!ws || ws.readyState !== WebSocket.OPEN) return;
	ws.send(JSON.stringify({ type: 'item_deleted', itemId }));
}

export function sendCommentCreated(comment: unknown): void {
	if (!ws || ws.readyState !== WebSocket.OPEN) return;
	ws.send(JSON.stringify({ type: 'comment_created', comment }));
}

export function sendReplyCreated(commentId: string, reply: unknown): void {
	if (!ws || ws.readyState !== WebSocket.OPEN) return;
	ws.send(JSON.stringify({ type: 'reply_created', commentId, reply }));
}

export function sendCommentResolved(commentId: string, resolved: boolean): void {
	if (!ws || ws.readyState !== WebSocket.OPEN) return;
	ws.send(JSON.stringify({ type: 'comment_resolved', commentId, resolved }));
}

export function sendCommentDeleted(commentId: string): void {
	if (!ws || ws.readyState !== WebSocket.OPEN) return;
	ws.send(JSON.stringify({ type: 'comment_deleted', commentId }));
}
