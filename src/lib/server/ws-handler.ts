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

interface WSData {
	projectId: string;
	connectionId: string;
	user: DBUser;
}

type WSMessage =
	| { type: 'cursor_move'; x: number; y: number }
	| { type: 'lock_item'; itemId: string }
	| { type: 'unlock_item' }
	| { type: 'select_item'; itemId: string | null }
	| { type: 'item_updated'; item: unknown }
	| { type: 'item_created'; item: unknown }
	| { type: 'item_deleted'; itemId: string };

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
	const match = url.pathname.match(/^\/ws\/projects\/([^/]+)$/);
	if (!match) return undefined;

	const projectId = match[1];
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

	const connectionId = crypto.randomUUID();
	const upgraded = server.upgrade(req, {
		data: {
			projectId,
			connectionId,
			user: session.user
		} satisfies WSData
	});

	return upgraded ? undefined : new Response('Upgrade failed', { status: 500 });
}

export function handleWSOpen(ws: ServerWebSocket<WSData>): void {
	const { projectId, connectionId, user } = ws.data;

	// Add to project connections
	let connections = projectConnections.get(projectId);
	if (!connections) {
		connections = new Set();
		projectConnections.set(projectId, connections);
	}
	connections.add(ws);

	// Add collaborator and get state
	const state = addCollaborator(projectId, connectionId, user);

	// Send current collaborators to new user
	const collaborators = getCollaborators(projectId);
	ws.send(JSON.stringify({
		type: 'init',
		collaborators: collaborators.filter((c) => c.user.id !== user.id),
		yourColor: state.color
	}));

	// Broadcast join to others
	broadcastToProject(
		projectId,
		{ type: 'user_joined', user: state.user, color: state.color },
		connectionId
	);
}

export function handleWSMessage(ws: ServerWebSocket<WSData>, message: string): void {
	const { projectId, connectionId, user } = ws.data;

	try {
		const msg = JSON.parse(message) as WSMessage;

		switch (msg.type) {
			case 'cursor_move':
				updateCursor(projectId, connectionId, msg.x, msg.y);
				broadcastToProject(
					projectId,
					{ type: 'cursor_move', userId: user.id, x: msg.x, y: msg.y },
					connectionId
				);
				break;

			case 'lock_item':
				if (lockItem(projectId, connectionId, msg.itemId)) {
					broadcastToProject(projectId, {
						type: 'item_locked',
						itemId: msg.itemId,
						userId: user.id
					});
				}
				break;

			case 'unlock_item': {
				const unlockedItemId = unlockItem(projectId, connectionId);
				if (unlockedItemId) {
					broadcastToProject(projectId, {
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
				broadcastToProject(projectId, msg, connectionId);
				break;
		}
	} catch (err) {
		console.error('WebSocket message error:', err);
	}
}

export function handleWSClose(ws: ServerWebSocket<WSData>): void {
	const { projectId, connectionId, user } = ws.data;

	// Remove from connections
	const connections = projectConnections.get(projectId);
	if (connections) {
		connections.delete(ws);
		if (connections.size === 0) {
			projectConnections.delete(projectId);
		}
	}

	// Remove collaborator (also releases locks)
	removeCollaborator(projectId, connectionId);

	// Broadcast leave
	broadcastToProject(projectId, { type: 'user_left', userId: user.id });
}
