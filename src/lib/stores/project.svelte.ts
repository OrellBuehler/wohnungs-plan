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
	created_at: string | Date;
	updated_at: string | Date;
	currency: string;
	grid_size: number;
}

interface ApiItem {
	id: string;
	name: string;
	width: number;
	height: number;
	x: number | null;
	y: number | null;
	rotation: number;
	color: string;
	price: number | null;
	price_currency: string;
	product_url: string | null;
	shape: string;
	cutout_width: number | null;
	cutout_height: number | null;
	cutout_corner: string | null;
}

interface ApiFloorplan {
	id: string;
	project_id: string;
	filename: string;
	mime_type: string;
	size_bytes: number;
	scale: number | null;
	reference_length: number | null;
	created_at: string | Date;
	updated_at: string | Date;
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
		priceCurrency: item.price_currency as CurrencyCode,
		productUrl: item.product_url,
		position: item.x !== null && item.y !== null ? { x: item.x, y: item.y } : null,
		rotation: item.rotation ?? 0,
		shape: item.shape as Item['shape'],
		cutoutWidth: item.cutout_width ?? undefined,
		cutoutHeight: item.cutout_height ?? undefined,
		cutoutCorner: item.cutout_corner ?? undefined
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
		createdAt: toIsoString(project.created_at),
		updatedAt: toIsoString(project.updated_at),
		floorplan: floorplan
			? {
				imageData: `/api/images/floorplans/${project.id}/${floorplan.filename}`,
				scale: floorplan.scale ?? 0,
				referenceLength: floorplan.reference_length ?? 0
			}
			: null,
		items: items.map(mapApiItem),
		currency: project.currency as CurrencyCode,
		gridSize: project.grid_size
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

	await fetch(`/api/projects/${projectId}/floorplan`, {
		method: 'POST',
		body: formData
	});
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
	if (!useRemote()) {
		return getLocalProjects();
	}

	try {
		const response = await fetch('/api/projects');
		if (!response.ok) throw new Error('Failed to load projects');
		const data = await response.json();
		return (data.projects as ApiProject[]).map((project) => ({
			id: project.id,
			name: project.name,
			createdAt: toIsoString(project.created_at),
			updatedAt: toIsoString(project.updated_at)
		}));
	} catch (error) {
		console.error('Failed to load remote projects:', error);
		return getLocalProjects();
	}
}

export async function loadProjectById(id: string): Promise<Project | null> {
	if (!useRemote()) {
		const local = await loadLocalProject(id);
		return local ?? null;
	}

	try {
		const response = await fetch(`/api/projects/${id}`);
		if (!response.ok) throw new Error('Failed to load project');
		const data = await response.json();
		const project = mapApiProject(data.project, data.items ?? [], data.floorplan ?? null);
		await saveLocalProject(project);
		return project;
	} catch (error) {
		console.error('Failed to load remote project:', error);
		const local = await loadLocalProject(id);
		return local ?? null;
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

		if (useRemote()) {
			void fetch(`/api/projects/${currentProject.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			});
		} else if (shouldQueue()) {
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

		if (useRemote()) {
			void uploadFloorplan(currentProject.id, floorplan);
		} else if (shouldQueue()) {
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

export function clearFloorplan() {
	if (currentProject) {
		currentProject.floorplan = null;
		debounceAutoSave();

		if (useRemote()) {
			void fetch(`/api/projects/${currentProject.id}/floorplan`, {
				method: 'DELETE'
			});
		} else if (shouldQueue()) {
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

		if (useRemote()) {
			void fetch(`/api/projects/${currentProject.id}/items`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildItemPayload(newItem))
			});
		} else if (shouldQueue()) {
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

		if (useRemote()) {
			void fetch(`/api/projects/${currentProject.id}/items/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildItemPayload(updatedItem))
			});
		} else if (shouldQueue()) {
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

		if (useRemote()) {
			void fetch(`/api/projects/${currentProject.id}/items/${id}`, {
				method: 'DELETE'
			});
		} else if (shouldQueue()) {
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

			if (useRemote()) {
				void fetch(`/api/projects/${currentProject.id}/items`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(buildItemPayload(newItem))
				});
			} else if (shouldQueue()) {
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

		if (useRemote()) {
			void fetch(`/api/projects/${currentProject.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ currency })
			});
		} else if (shouldQueue()) {
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

		if (useRemote()) {
			void fetch(`/api/projects/${currentProject.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ gridSize: currentProject.gridSize })
			});
		} else if (shouldQueue()) {
			queueChange({
				type: 'update',
				entity: 'project',
				projectId: currentProject.id,
				data: { gridSize: currentProject.gridSize }
			});
		}
	}
}
