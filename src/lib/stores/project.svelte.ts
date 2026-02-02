import type { Project, Item, Floorplan, Position, ProjectMeta } from '$lib/types';
import type { CurrencyCode } from '$lib/utils/currency';
import { DEFAULT_CURRENCY } from '$lib/utils/currency';
import {
	getAllProjects as getLocalProjects,
	getProject as loadLocalProject,
	saveProject as saveLocalProject,
	deleteProject as deleteLocalProject,
	createNewProject
} from '$lib/db';
import { isAuthenticated } from '$lib/stores/auth.svelte';
import { isOnline, queueChange } from '$lib/stores/sync.svelte';

interface ApiProject {
	id: string;
	name: string;
	createdAt: string | Date | null;
	updatedAt: string | Date | null;
	currency: string;
	gridSize: number;
}

interface ApiItem {
	id: string;
	name: string;
	width: number;
	height: number;
	x: number | null;
	y: number | null;
	rotation: number | null;
	color: string;
	price: number | null;
	priceCurrency: string | null;
	productUrl: string | null;
	shape: string;
	cutoutWidth: number | null;
	cutoutHeight: number | null;
	cutoutCorner: string | null;
}

interface ApiFloorplan {
	id: string;
	projectId: string;
	filename: string;
	mimeType: string;
	sizeBytes: number;
	scale: number | null;
	referenceLength: number | null;
	createdAt: string | Date | null;
	updatedAt: string | Date | null;
}

let currentProject = $state<Project | null>(null);
let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;

function debounceAutoSave() {
	if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
	if (currentProject) {
		autoSaveTimeout = setTimeout(() => {
			if (currentProject) {
				saveLocalProject(currentProject);
			}
		}, 1000);
	}
}

function useRemote(): boolean {
	return isAuthenticated() && isOnline();
}

function shouldQueue(): boolean {
	return isAuthenticated() && !isOnline();
}

// Check if we should sync the current project to cloud
// Only sync if authenticated, online, AND project is not local-only
function shouldSyncProject(): boolean {
	return useRemote() && !currentProject?.isLocal;
}

function shouldQueueProject(): boolean {
	return shouldQueue() && !currentProject?.isLocal;
}

function toIsoString(value: string | Date): string {
	return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapApiItem(item: ApiItem): Item {
	return {
		id: item.id,
		name: item.name,
		width: item.width,
		height: item.height,
		color: item.color,
		price: item.price,
		priceCurrency: (item.priceCurrency ?? 'EUR') as CurrencyCode,
		productUrl: item.productUrl,
		position: item.x !== null && item.y !== null ? { x: item.x, y: item.y } : null,
		rotation: item.rotation ?? 0,
		shape: item.shape as Item['shape'],
		cutoutWidth: item.cutoutWidth ?? undefined,
		cutoutHeight: item.cutoutHeight ?? undefined,
		cutoutCorner: item.cutoutCorner as Item['cutoutCorner']
	};
}

function mapApiProject(
	project: ApiProject,
	items: ApiItem[],
	floorplan: ApiFloorplan | null
): Project {
	return {
		id: project.id,
		name: project.name,
		createdAt: project.createdAt ? toIsoString(project.createdAt) : new Date().toISOString(),
		updatedAt: project.updatedAt ? toIsoString(project.updatedAt) : new Date().toISOString(),
		floorplan: floorplan
			? {
				imageData: `/api/images/floorplans/${project.id}/${floorplan.filename}`,
				scale: floorplan.scale ?? 0,
				referenceLength: floorplan.referenceLength ?? 0
			}
			: null,
		items: items.map(mapApiItem),
		currency: project.currency as CurrencyCode,
		gridSize: project.gridSize
	};
}

function buildItemPayload(item: Item): Record<string, unknown> {
	return {
		id: item.id,
		name: item.name,
		width: item.width,
		height: item.height,
		x: item.position?.x ?? null,
		y: item.position?.y ?? null,
		rotation: item.rotation ?? 0,
		color: item.color,
		price: item.price ?? null,
		priceCurrency: item.priceCurrency,
		productUrl: item.productUrl ?? null,
		shape: item.shape,
		cutoutWidth: item.cutoutWidth ?? null,
		cutoutHeight: item.cutoutHeight ?? null,
		cutoutCorner: item.cutoutCorner ?? null
	};
}

async function uploadFloorplan(projectId: string, floorplan: Floorplan): Promise<void> {
	const { data, mimeType } = parseDataUrl(floorplan.imageData);
	const file = new File([data], `floorplan.${mimeType.split('/')[1] ?? 'png'}`, {
		type: mimeType
	});

	const formData = new FormData();
	formData.set('file', file);

	const response = await fetch(`/api/projects/${projectId}/floorplan`, {
		method: 'POST',
		body: formData
	});

	if (!response.ok) {
		throw new Error('Failed to upload floorplan');
	}

	// Update scale after uploading
	if (floorplan.scale && floorplan.referenceLength) {
		await fetch(`/api/projects/${projectId}/floorplan`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				scale: floorplan.scale,
				referenceLength: floorplan.referenceLength
			})
		});
	}
}

function parseDataUrl(dataUrl: string): { data: Blob; mimeType: string } {
	const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
	if (!match) {
		return {
			data: new Blob([dataUrl], { type: 'image/png' }),
			mimeType: 'image/png'
		};
	}

	const mimeType = match[1] || 'image/png';
	const binary = atob(match[2]);
	const buffer = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		buffer[i] = binary.charCodeAt(i);
	}

	return { data: new Blob([buffer], { type: mimeType }), mimeType };
}

export function getProject() {
	return currentProject;
}

export function setProject(project: Project | null) {
	currentProject = project;
}

export async function listProjects(): Promise<ProjectMeta[]> {
	const localProjects = await getLocalProjects();
	const localMetas: ProjectMeta[] = localProjects.map((p) => ({
		...p,
		isLocal: true,
		floorplanUrl: null, // Will be loaded separately for local
		memberCount: 0
	}));

	if (!isAuthenticated()) {
		return localMetas;
	}

	try {
		const response = await fetch('/api/projects');
		if (!response.ok) throw new Error('Failed to load projects');
		const data = await response.json();
		const cloudMetas: ProjectMeta[] = data.projects;

		// Merge: cloud projects override local ones with same ID
		const cloudIds = new Set(cloudMetas.map((p: ProjectMeta) => p.id));
		const localOnly = localMetas.filter((p) => !cloudIds.has(p.id));

		return [...cloudMetas, ...localOnly].sort(
			(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
		);
	} catch (error) {
		console.error('Failed to load remote projects:', error);
		return localMetas;
	}
}

export async function getLocalFloorplanUrl(projectId: string): Promise<string | null> {
	const project = await loadLocalProject(projectId);
	return project?.floorplan?.imageData ?? null;
}

export async function syncProjectToCloud(projectId: string): Promise<boolean> {
	if (!isAuthenticated()) return false;

	const project = await loadLocalProject(projectId);
	if (!project) return false;

	try {
		// Create project in cloud
		const createRes = await fetch('/api/projects', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				id: project.id,
				name: project.name,
				currency: project.currency,
				gridSize: project.gridSize
			})
		});
		if (!createRes.ok) throw new Error('Failed to create project');

		// Upload floorplan if exists
		if (project.floorplan) {
			await uploadFloorplan(project.id, project.floorplan);
		}

		// Create all items - check each response
		for (const item of project.items) {
			const itemRes = await fetch(`/api/projects/${project.id}/items`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildItemPayload(item))
			});
			if (!itemRes.ok) {
				throw new Error(`Failed to create item: ${item.name}`);
			}
		}

		// Only remove from local storage after ALL operations succeed
		await deleteLocalProject(projectId);
		return true;
	} catch (error) {
		console.error('Failed to sync project:', error);
		return false;
	}
}

export async function loadProjectById(id: string): Promise<Project | null> {
	if (!useRemote()) {
		const local = await loadLocalProject(id);
		if (local) {
			return { ...local, isLocal: true };
		}
		return null;
	}

	try {
		const response = await fetch(`/api/projects/${id}`);
		if (!response.ok) throw new Error('Failed to load project');
		const data = await response.json();
		const project = mapApiProject(data.project, data.items ?? [], data.floorplan ?? null);
		project.isLocal = false;
		await saveLocalProject(project);
		return project;
	} catch (error) {
		console.error('Failed to load remote project:', error);
		const local = await loadLocalProject(id);
		if (local) {
			return { ...local, isLocal: true };
		}
		return null;
	}
}

export async function removeProject(id: string): Promise<void> {
	if (useRemote()) {
		try {
			await fetch(`/api/projects/${id}`, { method: 'DELETE' });
		} catch (error) {
			console.error('Failed to delete remote project:', error);
		}
	} else if (shouldQueue()) {
		queueChange({
			type: 'delete',
			entity: 'project',
			projectId: id
		});
	}

	await deleteLocalProject(id);
}

export function createProject(name?: string) {
	currentProject = createNewProject(name);
	saveLocalProject(currentProject);

	if (useRemote()) {
		void fetch('/api/projects', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				id: currentProject.id,
				name: currentProject.name,
				currency: currentProject.currency,
				gridSize: currentProject.gridSize
			})
		});
	} else if (shouldQueue()) {
		queueChange({
			type: 'create',
			entity: 'project',
			projectId: currentProject.id,
			data: {
				name: currentProject.name,
				currency: currentProject.currency,
				gridSize: currentProject.gridSize
			}
		});
	}

	return currentProject;
}

export function updateProjectName(name: string) {
	if (currentProject) {
		currentProject.name = name;
		debounceAutoSave();

		if (shouldSyncProject()) {
			void fetch(`/api/projects/${currentProject.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			});
		} else if (shouldQueueProject()) {
			queueChange({
				type: 'update',
				entity: 'project',
				projectId: currentProject.id,
				data: { name }
			});
		}
	}
}

export function setFloorplan(floorplan: Floorplan) {
	if (currentProject) {
		currentProject.floorplan = floorplan;
		debounceAutoSave();

		if (shouldSyncProject()) {
			void uploadFloorplan(currentProject.id, floorplan);
		} else if (shouldQueueProject()) {
			queueChange({
				type: 'create',
				entity: 'floorplan',
				projectId: currentProject.id,
				data: {
					imageData: floorplan.imageData,
					scale: floorplan.scale,
					referenceLength: floorplan.referenceLength
				}
			});
		}
	}
}

export function updateFloorplanScale(scale: number, referenceLength: number) {
	if (currentProject?.floorplan) {
		currentProject.floorplan = {
			...currentProject.floorplan,
			scale,
			referenceLength
		};
		debounceAutoSave();

		if (shouldSyncProject()) {
			void fetch(`/api/projects/${currentProject.id}/floorplan`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ scale, referenceLength })
			});
		} else if (shouldQueueProject()) {
			queueChange({
				type: 'update',
				entity: 'floorplan',
				projectId: currentProject.id,
				data: { scale, referenceLength }
			});
		}
	}
}

export function clearFloorplan() {
	if (currentProject) {
		currentProject.floorplan = null;
		debounceAutoSave();

		if (shouldSyncProject()) {
			void fetch(`/api/projects/${currentProject.id}/floorplan`, {
				method: 'DELETE'
			});
		} else if (shouldQueueProject()) {
			queueChange({
				type: 'delete',
				entity: 'floorplan',
				projectId: currentProject.id
			});
		}
	}
}

export function addItem(item: Omit<Item, 'id'>) {
	if (currentProject) {
		const newItem: Item = {
			...item,
			id: crypto.randomUUID()
		};
		currentProject.items = [...currentProject.items, newItem];
		debounceAutoSave();

		if (shouldSyncProject()) {
			void fetch(`/api/projects/${currentProject.id}/items`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildItemPayload(newItem))
			});
		} else if (shouldQueueProject()) {
			queueChange({
				type: 'create',
				entity: 'item',
				projectId: currentProject.id,
				data: buildItemPayload(newItem)
			});
		}

		return newItem;
	}
	return null;
}

export function updateItem(id: string, updates: Partial<Item>) {
	if (currentProject) {
		currentProject.items = currentProject.items.map((item) =>
			item.id === id ? { ...item, ...updates } : item
		);
		debounceAutoSave();

		const updatedItem = currentProject.items.find((item) => item.id === id);
		if (!updatedItem) return;

		if (shouldSyncProject()) {
			void fetch(`/api/projects/${currentProject.id}/items/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildItemPayload(updatedItem))
			});
		} else if (shouldQueueProject()) {
			queueChange({
				type: 'update',
				entity: 'item',
				projectId: currentProject.id,
				entityId: id,
				data: buildItemPayload(updatedItem)
			});
		}
	}
}

export function deleteItem(id: string) {
	if (currentProject) {
		currentProject.items = currentProject.items.filter((item) => item.id !== id);
		debounceAutoSave();

		if (shouldSyncProject()) {
			void fetch(`/api/projects/${currentProject.id}/items/${id}`, {
				method: 'DELETE'
			});
		} else if (shouldQueueProject()) {
			queueChange({
				type: 'delete',
				entity: 'item',
				projectId: currentProject.id,
				entityId: id
			});
		}
	}
}

export function updateItemPosition(id: string, position: Position | null) {
	updateItem(id, { position });
}

export function updateItemRotation(id: string, rotation: number) {
	updateItem(id, { rotation });
}

export function duplicateItem(id: string) {
	if (currentProject) {
		const item = currentProject.items.find((i) => i.id === id);
		if (item) {
			const newItem: Item = {
				...item,
				id: crypto.randomUUID(),
				position: item.position
					? { x: item.position.x + 20, y: item.position.y + 20 }
					: null
			};
			currentProject.items = [...currentProject.items, newItem];
			debounceAutoSave();

			if (shouldSyncProject()) {
				void fetch(`/api/projects/${currentProject.id}/items`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(buildItemPayload(newItem))
				});
			} else if (shouldQueueProject()) {
				queueChange({
					type: 'create',
					entity: 'item',
					projectId: currentProject.id,
					data: buildItemPayload(newItem)
				});
			}

			return newItem;
		}
	}
	return null;
}

export function getItems() {
	return currentProject?.items ?? [];
}

export function getPlacedItems() {
	return (currentProject?.items ?? []).filter((item) => item.position !== null);
}

export function getUnplacedItems() {
	return (currentProject?.items ?? []).filter((item) => item.position === null);
}

export function getTotalCost() {
	return (currentProject?.items ?? []).reduce(
		(sum, item) => sum + (item.price ?? 0),
		0
	);
}

export function getCurrency(): CurrencyCode {
	return currentProject?.currency ?? DEFAULT_CURRENCY;
}

export function setCurrency(currency: CurrencyCode) {
	if (currentProject) {
		currentProject.currency = currency;
		debounceAutoSave();

		if (shouldSyncProject()) {
			void fetch(`/api/projects/${currentProject.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ currency })
			});
		} else if (shouldQueueProject()) {
			queueChange({
				type: 'update',
				entity: 'project',
				projectId: currentProject.id,
				data: { currency }
			});
		}
	}
}

export function getGridSize(): number {
	return currentProject?.gridSize ?? 50;
}

export function setGridSize(gridSize: number) {
	if (currentProject) {
		currentProject.gridSize = Math.max(1, Math.min(200, gridSize));
		debounceAutoSave();

		if (shouldSyncProject()) {
			void fetch(`/api/projects/${currentProject.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ gridSize: currentProject.gridSize })
			});
		} else if (shouldQueueProject()) {
			queueChange({
				type: 'update',
				entity: 'project',
				projectId: currentProject.id,
				data: { gridSize: currentProject.gridSize }
			});
		}
	}
}
