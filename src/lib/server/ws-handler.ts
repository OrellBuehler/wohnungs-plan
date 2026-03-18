import type { ServerWebSocket } from 'bun';
import {
	addCollaborator,
	removeCollaborator,
	updateCursor,
	lockItem,
	unlockItem,
	getCollaborators
} from './collaboration';
import { getProjectRole } from './projects';
import { getSessionWithUser, parseSessionCookie } from './session';
import type { DBUser } from './types';
import { getBranchById } from './branches';

interface WSData {
	projectId: string;
	branchId: string;
	roomId: string;
	connectionId: string;
	user: DBUser;
}

type WSMessage =
	| { type: 'cursor_move'; x: number; y: number }
	| { type: 'lock_item'; itemId: string }
	| { type: 'unlock_item' }
	| { type: 'item_updated'; item: unknown; branchId?: string }
	| { type: 'item_created'; item: unknown; branchId?: string }
	| { type: 'item_deleted'; itemId: string; branchId?: string }
	| { type: 'comment_created'; comment: unknown }
	| { type: 'reply_created'; commentId: string; reply: unknown }
	| { type: 'comment_resolved'; commentId: string; resolved: boolean }
	| { type: 'comment_deleted'; commentId: string };

const VALID_MESSAGE_TYPES = new Set([
	'cursor_move',
	'lock_item',
	'unlock_item',
	'item_updated',
	'item_created',
	'item_deleted',
	'comment_created',
	'reply_created',
	'comment_resolved',
	'comment_deleted'
]);

function isValidMessage(raw: unknown): raw is WSMessage {
	if (typeof raw !== 'object' || raw === null) return false;
	const msg = raw as Record<string, unknown>;
	if (typeof msg.type !== 'string' || !VALID_MESSAGE_TYPES.has(msg.type)) return false;
	switch (msg.type) {
		case 'cursor_move':
			return typeof msg.x === 'number' && typeof msg.y === 'number';
		case 'lock_item':
			return typeof msg.itemId === 'string';
		case 'unlock_item':
			return true;
		case 'item_updated':
		case 'item_created':
			return typeof msg.item === 'object' && msg.item !== null && typeof (msg.item as Record<string, unknown>).id !== 'undefined';
		case 'item_deleted':
			return typeof msg.itemId === 'string';
		case 'comment_created':
			return typeof msg.comment === 'object' && msg.comment !== null;
		case 'reply_created':
			return typeof msg.commentId === 'string' && typeof msg.reply === 'object' && msg.reply !== null;
		case 'comment_resolved':
			return typeof msg.commentId === 'string' && typeof msg.resolved === 'boolean';
		case 'comment_deleted':
			return typeof msg.commentId === 'string';
		default:
			return false;
	}
}

const projectConnections = new Map<string, Set<ServerWebSocket<WSData>>>();

export function broadcastToProject(
	projectId: string,
	message: unknown,
	excludeConnectionId?: string
): void {
	const connections = projectConnections.get(projectId);
	if (!connections) return;

	const data = JSON.stringify(message);
	for (const ws of connections) {
		if (ws.data.connectionId !== excludeConnectionId) {
			ws.send(data);
		}
	}
}

export async function handleWSUpgrade(
	req: Request,
	server: { upgrade: (req: Request, options: unknown) => boolean }
): Promise<Response | undefined> {
	const url = new URL(req.url);
	const match = url.pathname.match(/^\/ws\/projects\/([^/]+)\/branches\/([^/]+)$/);
	if (!match) return undefined;

	const projectId = match[1];
	const branchId = match[2];
	const cookie = req.headers.get('cookie');
	const sessionId = parseSessionCookie(cookie);

	if (!sessionId) {
		return new Response('Unauthorized', { status: 401 });
	}

	const session = await getSessionWithUser(sessionId);
	if (!session) {
		return new Response('Unauthorized', { status: 401 });
	}

	const role = await getProjectRole(projectId, session.user.id);
	if (!role) {
		return new Response('Forbidden', { status: 403 });
	}

	const branch = await getBranchById(projectId, branchId);
	if (!branch) {
		return new Response('Branch not found', { status: 404 });
	}

	const roomId = `project:${projectId}:branch:${branchId}`;
	const connectionId = crypto.randomUUID();
	const upgraded = server.upgrade(req, {
		data: {
			projectId,
			branchId,
			roomId,
			connectionId,
			user: session.user
		} satisfies WSData
	});

	return upgraded ? undefined : new Response('Upgrade failed', { status: 500 });
}

export function handleWSOpen(ws: ServerWebSocket<WSData>): void {
	const { roomId, connectionId, user } = ws.data;

	// Add to project connections
	let connections = projectConnections.get(roomId);
	if (!connections) {
		connections = new Set();
		projectConnections.set(roomId, connections);
	}
	connections.add(ws);

	// Add collaborator and get state
	const state = addCollaborator(roomId, connectionId, user);

	// Send current collaborators to new user
	const collaborators = getCollaborators(roomId);
	ws.send(JSON.stringify({
		type: 'init',
		collaborators: collaborators.filter((c) => c.user.id !== user.id),
		yourColor: state.color
	}));

	// Broadcast join to others
	broadcastToProject(
		roomId,
		{ type: 'user_joined', user: state.user, color: state.color },
		connectionId
	);
}

export function handleWSMessage(ws: ServerWebSocket<WSData>, message: string): void {
	const { roomId, branchId, connectionId, user } = ws.data;

	try {
		const raw: unknown = JSON.parse(message);
		if (!isValidMessage(raw)) return;
		const msg = raw;

		switch (msg.type) {
			case 'cursor_move':
				updateCursor(roomId, connectionId, msg.x, msg.y);
				broadcastToProject(
					roomId,
					{ type: 'cursor_move', userId: user.id, x: msg.x, y: msg.y },
					connectionId
				);
				break;

			case 'lock_item':
				if (lockItem(roomId, connectionId, msg.itemId)) {
					broadcastToProject(roomId, {
						type: 'item_locked',
						itemId: msg.itemId,
						userId: user.id
					});
				}
				break;

			case 'unlock_item': {
				const unlockedItemId = unlockItem(roomId, connectionId);
				if (unlockedItemId) {
					broadcastToProject(roomId, {
						type: 'item_unlocked',
						itemId: unlockedItemId
					});
				}
				break;
			}

			case 'item_updated':
			case 'item_created':
			case 'item_deleted':
				// Broadcast to others (the sender already has the update)
				broadcastToProject(roomId, { ...msg, branchId }, connectionId);
				break;

			case 'comment_created':
			case 'reply_created':
			case 'comment_resolved':
			case 'comment_deleted':
				broadcastToProject(roomId, { ...msg, branchId }, connectionId);
				break;
		}
	} catch (err) {
		console.error('WebSocket message error:', err);
	}
}

export function handleWSClose(ws: ServerWebSocket<WSData>): void {
	const { roomId, connectionId, user } = ws.data;

	// Remove from connections
	const connections = projectConnections.get(roomId);
	if (connections) {
		connections.delete(ws);
		if (connections.size === 0) {
			projectConnections.delete(roomId);
		}
	}

	// Remove collaborator (also releases locks)
	removeCollaborator(roomId, connectionId);

	// Broadcast leave
	broadcastToProject(roomId, { type: 'user_left', userId: user.id });
}
