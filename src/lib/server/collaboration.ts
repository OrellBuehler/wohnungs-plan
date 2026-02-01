import type { DBUser } from './types';

interface Cursor {
	x: number;
	y: number;
	timestamp: number;
}

interface CollaboratorState {
	user: {
		id: string;
		name: string | null;
		avatarUrl: string | null;
	};
	color: string;
	cursor: Cursor | null;
	selectedItemId: string | null;
	lockedItemId: string | null;
	lastActivity: number;
}

interface ProjectRoom {
	projectId: string;
	collaborators: Map<string, CollaboratorState>;
	lockedItems: Map<string, string>; // itemId -> userId
}

const COLORS = [
	'#ef4444', '#f97316', '#eab308', '#22c55e',
	'#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'
];

const rooms = new Map<string, ProjectRoom>();

export function getOrCreateRoom(projectId: string): ProjectRoom {
	let room = rooms.get(projectId);
	if (!room) {
		room = {
			projectId,
			collaborators: new Map(),
			lockedItems: new Map()
		};
		rooms.set(projectId, room);
	}
	return room;
}

export function addCollaborator(
	projectId: string,
	connectionId: string,
	user: DBUser
): CollaboratorState {
	const room = getOrCreateRoom(projectId);

	// Assign color (use one not in use, or cycle)
	const usedColors = new Set(
		Array.from(room.collaborators.values()).map((c) => c.color)
	);
	const color = COLORS.find((c) => !usedColors.has(c)) ?? COLORS[room.collaborators.size % COLORS.length];

	const state: CollaboratorState = {
		user: {
			id: user.id,
			name: user.name,
			avatarUrl: user.avatar_url
		},
		color,
		cursor: null,
		selectedItemId: null,
		lockedItemId: null,
		lastActivity: Date.now()
	};

	room.collaborators.set(connectionId, state);
	return state;
}

export function removeCollaborator(projectId: string, connectionId: string): void {
	const room = rooms.get(projectId);
	if (!room) return;

	const collaborator = room.collaborators.get(connectionId);
	if (collaborator?.lockedItemId) {
		room.lockedItems.delete(collaborator.lockedItemId);
	}

	room.collaborators.delete(connectionId);

	// Clean up empty rooms
	if (room.collaborators.size === 0) {
		rooms.delete(projectId);
	}
}

export function updateCursor(
	projectId: string,
	connectionId: string,
	x: number,
	y: number
): void {
	const room = rooms.get(projectId);
	const collaborator = room?.collaborators.get(connectionId);
	if (collaborator) {
		collaborator.cursor = { x, y, timestamp: Date.now() };
		collaborator.lastActivity = Date.now();
	}
}

export function lockItem(
	projectId: string,
	connectionId: string,
	itemId: string
): boolean {
	const room = rooms.get(projectId);
	if (!room) return false;

	// Check if already locked by someone else
	const existingLock = room.lockedItems.get(itemId);
	const collaborator = room.collaborators.get(connectionId);
	if (!collaborator) return false;

	if (existingLock && existingLock !== collaborator.user.id) {
		return false;
	}

	// Release any previous lock by this user
	if (collaborator.lockedItemId) {
		room.lockedItems.delete(collaborator.lockedItemId);
	}

	room.lockedItems.set(itemId, collaborator.user.id);
	collaborator.lockedItemId = itemId;
	collaborator.lastActivity = Date.now();
	return true;
}

export function unlockItem(projectId: string, connectionId: string): string | null {
	const room = rooms.get(projectId);
	if (!room) return null;

	const collaborator = room.collaborators.get(connectionId);
	if (!collaborator?.lockedItemId) return null;

	const itemId = collaborator.lockedItemId;
	room.lockedItems.delete(itemId);
	collaborator.lockedItemId = null;
	return itemId;
}

export function getCollaborators(projectId: string): CollaboratorState[] {
	const room = rooms.get(projectId);
	return room ? Array.from(room.collaborators.values()) : [];
}

export function getLockedItems(projectId: string): Map<string, string> {
	return rooms.get(projectId)?.lockedItems ?? new Map();
}

export function isItemLocked(projectId: string, itemId: string, excludeUserId?: string): boolean {
	const room = rooms.get(projectId);
	if (!room) return false;
	const lockHolder = room.lockedItems.get(itemId);
	return lockHolder !== undefined && lockHolder !== excludeUserId;
}
