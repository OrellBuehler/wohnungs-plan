import { isAuthenticated, authFetch } from './auth.svelte';
import { parseDataUrl } from '$lib/utils/data';

interface SyncState {
	isOnline: boolean;
	isSyncing: boolean;
	pendingChanges: number;
	lastSynced: Date | null;
	error: string | null;
}

let state = $state<SyncState>({
	isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
	isSyncing: false,
	pendingChanges: 0,
	lastSynced: null,
	error: null
});

// Pending changes queue (stored in memory, could persist to IndexedDB)
interface PendingChange {
	id: string;
	type: 'create' | 'update' | 'delete';
	entity: 'project' | 'item' | 'floorplan';
	projectId: string;
	branchId?: string;
	entityId?: string;
	data?: unknown;
	timestamp: number;
}

let pendingQueue: PendingChange[] = $state([]);

export function getSyncState(): SyncState {
	return state;
}

export function isOnline(): boolean {
	return state.isOnline;
}

export function getPendingChanges(): number {
	return state.pendingChanges;
}

export function setOnline(online: boolean): void {
	state.isOnline = online;
	if (online && pendingQueue.length > 0) {
		processPendingChanges();
	}
}

export function queueChange(change: Omit<PendingChange, 'id' | 'timestamp'>): void {
	const newChange: PendingChange = {
		...change,
		id: crypto.randomUUID(),
		timestamp: Date.now()
	};
	pendingQueue.push(newChange);
	state.pendingChanges = pendingQueue.length;
}

export async function processPendingChanges(): Promise<void> {
	if (!isAuthenticated() || !state.isOnline || state.isSyncing) return;
	if (pendingQueue.length === 0) return;

	state.isSyncing = true;
	state.error = null;

	try {
		// Process changes in order
		while (pendingQueue.length > 0) {
			const change = pendingQueue[0];
			await processChange(change);
			pendingQueue.shift();
			state.pendingChanges = pendingQueue.length;
		}
		state.lastSynced = new Date();
	} catch (err) {
		state.error = err instanceof Error ? err.message : 'Sync failed';
	} finally {
		state.isSyncing = false;
	}
}

async function processChange(change: PendingChange): Promise<void> {
	const baseUrl = `/api/projects/${change.projectId}`;

	async function doFetch(input: string, init?: RequestInit): Promise<void> {
		const res = await authFetch(input, init);
		if (res.status === 401) throw new Error('Unauthorized');
		if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
	}

	switch (change.entity) {
		case 'item': {
			const itemBaseUrl = change.branchId
				? `${baseUrl}/branches/${change.branchId}/items`
				: `${baseUrl}/items`;

			if (change.type === 'create') {
				await doFetch(itemBaseUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(change.data)
				});
			} else if (change.type === 'update' && change.entityId) {
				await doFetch(`${itemBaseUrl}/${change.entityId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(change.data)
				});
			} else if (change.type === 'delete' && change.entityId) {
				await doFetch(`${itemBaseUrl}/${change.entityId}`, { method: 'DELETE' });
			}
			break;
		}

		case 'project': {
			if (change.type === 'create') {
				await doFetch('/api/projects', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id: change.projectId, ...(change.data ?? {}) })
				});
			} else if (change.type === 'update') {
				await doFetch(baseUrl, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(change.data)
				});
			} else if (change.type === 'delete') {
				await doFetch(baseUrl, { method: 'DELETE' });
			}
			break;
		}

		case 'floorplan': {
			if (change.type === 'create' && change.data) {
				const payload = change.data as {
					imageData: string;
					scale?: number;
					referenceLength?: number;
				};
				const { data, mimeType } = parseDataUrl(payload.imageData);
				const file = new File([data], `floorplan.${mimeType.split('/')[1] ?? 'png'}`, {
					type: mimeType
				});
				const formData = new FormData();
				formData.set('file', file);
				await doFetch(`${baseUrl}/floorplan`, { method: 'POST', body: formData });
			} else if (change.type === 'delete') {
				await doFetch(`${baseUrl}/floorplan`, { method: 'DELETE' });
			}
			break;
		}
	}
}

// Initialize online/offline listeners
if (typeof window !== 'undefined') {
	window.addEventListener('online', () => setOnline(true));
	window.addEventListener('offline', () => setOnline(false));
}
