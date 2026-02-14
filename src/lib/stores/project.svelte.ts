import type { Project, Item, ItemImage, Floorplan, Position, ProjectMeta, ProjectBranch, ItemChange } from '$lib/types';
import type { CurrencyCode } from '$lib/utils/currency';
import { parseDataUrl } from '$lib/utils/data';
import { DEFAULT_CURRENCY } from '$lib/utils/currency';
import {
	getAllProjects as getLocalProjects,
	getProject as loadLocalProject,
	saveProject as saveLocalProject,
	deleteProject as deleteLocalProject,
	createNewProject,
	getThumbnail,
	saveThumbnail
} from '$lib/db';
import { isAuthenticated, authFetch } from '$lib/stores/auth.svelte';
import { isOnline, queueChange } from '$lib/stores/sync.svelte';

interface ApiProject {
	id: string;
	name: string;
	createdAt: string | Date | null;
	updatedAt: string | Date | null;
	currency: string;
	gridSize: number;
}

interface ApiBranch {
	id: string;
	projectId: string;
	name: string;
	forkedFromId: string | null;
	createdBy: string;
	createdAt: string | Date | null;
}

interface ApiItemImage {
	id: string;
	projectId: string;
	itemId: string;
	filename: string;
	originalName: string | null;
	mimeType: string;
	sizeBytes: number;
	sortOrder: number;
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
	images?: ApiItemImage[];
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

function mapApiBranch(branch: ApiBranch): ProjectBranch {
	return {
		id: branch.id,
		projectId: branch.projectId,
		name: branch.name,
		forkedFromId: branch.forkedFromId,
		createdBy: branch.createdBy,
		createdAt: branch.createdAt ? toIsoString(branch.createdAt) : new Date().toISOString()
	};
}

function ensureProjectBranches(project: Project): Project {
	if (project.branches && project.branches.length > 0) {
		return {
			...project,
			activeBranchId: project.activeBranchId ?? project.branches[0].id
		};
	}

	const now = project.createdAt ?? new Date().toISOString();
	const mainBranchId = crypto.randomUUID();
	return {
		...project,
		branches: [
			{
				id: mainBranchId,
				projectId: project.id,
				name: 'Main',
				forkedFromId: null,
				createdBy: 'local',
				createdAt: now
			}
		],
		activeBranchId: mainBranchId
	};
}

function getActiveBranchId(project: Project | null): string | null {
	if (!project) return null;
	if (project.activeBranchId) return project.activeBranchId;
	if (project.branches && project.branches.length > 0) return project.branches[0].id;
	return null;
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

function mapApiItemImage(img: ApiItemImage): ItemImage {
	return {
		id: img.id,
		filename: img.filename,
		originalName: img.originalName,
		mimeType: img.mimeType,
		sizeBytes: img.sizeBytes,
		sortOrder: img.sortOrder,
		url: `/api/images/items/${img.projectId}/${img.itemId}/${img.filename}`,
		thumbUrl: `/api/images/items/${img.projectId}/${img.itemId}/${img.filename}?thumb=1`
	};
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
		cutoutCorner: item.cutoutCorner as Item['cutoutCorner'],
		images: item.images?.map(mapApiItemImage)
	};
}

function mapApiProject(
	project: ApiProject,
	items: ApiItem[],
	floorplan: ApiFloorplan | null,
	branches: ApiBranch[] = [],
	activeBranchId?: string,
	defaultBranchId?: string
): Project {
	return ensureProjectBranches({
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
		branches: branches.map(mapApiBranch),
		activeBranchId: activeBranchId ?? null,
		defaultBranchId: defaultBranchId ?? null,
		currency: project.currency as CurrencyCode,
		gridSize: project.gridSize
	});
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

	const response = await authFetch(`/api/projects/${projectId}/floorplan`, {
		method: 'POST',
		body: formData
	});

	if (!response.ok) {
		throw new Error('Failed to upload floorplan');
	}

	// Update scale after uploading
	if (floorplan.scale && floorplan.referenceLength) {
		await authFetch(`/api/projects/${projectId}/floorplan`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				scale: floorplan.scale,
				referenceLength: floorplan.referenceLength
			})
		});
	}
}

function getBranchItemsBase(project: Project | null): string | null {
	const branchId = getActiveBranchId(project);
	if (!project || !branchId) return null;
	return `/api/projects/${project.id}/branches/${branchId}/items`;
}

export function getProject() {
	return currentProject;
}

export function setProject(project: Project | null) {
	currentProject = project ? ensureProjectBranches(project) : null;
}

export function getBranches(): ProjectBranch[] {
	return currentProject?.branches ?? [];
}

export function getDefaultBranchId(): string | null {
	return currentProject?.defaultBranchId ?? currentProject?.branches?.[0]?.id ?? null;
}

export function getActiveBranch(): ProjectBranch | null {
	const project = currentProject;
	const activeBranchId = getActiveBranchId(project);
	if (!project || !activeBranchId || !project.branches) return null;
	return project.branches.find((branch) => branch.id === activeBranchId) ?? null;
}

export async function listProjects(): Promise<ProjectMeta[]> {
	const localProjects = await getLocalProjects();
	const localMetas: ProjectMeta[] = localProjects.map((p) => ({
		...p,
		isLocal: true,
		thumbnailUrl: null,
		floorplanUrl: null, // Will be loaded separately for local
		memberCount: 0
	}));

	if (!isAuthenticated()) {
		return localMetas;
	}

	try {
		const response = await authFetch('/api/projects');
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
		const createRes = await authFetch('/api/projects', {
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

		const projectRes = await authFetch(`/api/projects/${project.id}`);
		if (!projectRes.ok) throw new Error('Failed to load created project');
		const projectData = await projectRes.json();
		const defaultBranchId: string | null =
			projectData.activeBranchId ?? projectData.defaultBranchId ?? null;
		if (!defaultBranchId) throw new Error('No default branch available');

		// Upload floorplan if exists
		if (project.floorplan) {
			await uploadFloorplan(project.id, project.floorplan);
		}

		// Create all items - check each response
		for (const item of project.items) {
			const itemRes = await authFetch(
				`/api/projects/${project.id}/branches/${defaultBranchId}/items`,
				{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildItemPayload(item))
				}
			);
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

export async function loadProjectById(id: string, branchId?: string): Promise<Project | null> {
	// Always check local storage first
	const local = await loadLocalProject(id);

	// If project exists locally and is marked as local-only, return it without API call
	if (local?.isLocal) {
		if (branchId && local.branches?.some((branch) => branch.id === branchId)) {
			return { ...local, activeBranchId: branchId };
		}
		return local;
	}

	// If not authenticated or offline, return local version if available
	if (!useRemote()) {
		if (!local) return null;
		if (branchId && local.branches?.some((branch) => branch.id === branchId)) {
			return { ...local, isLocal: true, activeBranchId: branchId };
		}
		return { ...local, isLocal: true };
	}

	// Project is either not in IndexedDB or is a cloud project - fetch from API
	try {
		const endpoint = branchId
			? `/api/projects/${id}?branch=${encodeURIComponent(branchId)}`
			: `/api/projects/${id}`;
		const response = await authFetch(endpoint);
		if (!response.ok) throw new Error('Failed to load project');
		const data = await response.json();
		const project = mapApiProject(
			data.project,
			data.items ?? [],
			data.floorplan ?? null,
			data.branches ?? [],
			data.activeBranchId,
			data.defaultBranchId
		);
		project.isLocal = false;
		await saveLocalProject(project);

		// Load floorplan analysis in parallel (don't block project load)
		void loadFloorplanAnalysis(id);

		return project;
	} catch (error) {
		console.error('Failed to load remote project:', error);
		// Fallback to local version if API fails
		return local ? { ...local, isLocal: true } : null;
	}
}

export async function setActiveBranch(branchId: string): Promise<boolean> {
	if (!currentProject) return false;
	if (!currentProject.branches?.some((branch) => branch.id === branchId)) return false;

	// Try cloud path if authenticated and online (even if project was loaded as local)
	if (useRemote()) {
		try {
			const response = await authFetch(
				`/api/projects/${currentProject.id}/branches/${branchId}/items`
			);
			if (response.ok) {
				const data = await response.json();
				// Reassign entire object to guarantee Svelte 5 reactivity propagation
				currentProject = {
					...currentProject,
					items: (data.items ?? []).map(mapApiItem),
					activeBranchId: branchId,
					isLocal: false
				};
				await saveLocalProject(currentProject);
				return true;
			}
		} catch (error) {
			console.error('Failed to load branch items from cloud:', error);
		}
	}

	// Fallback: local-only branch switch (no items reload)
	currentProject.activeBranchId = branchId;
	debounceAutoSave();
	return true;
}

export async function createProjectBranch(
	name: string,
	forkFromBranchId?: string | null
): Promise<ProjectBranch | null> {
	if (!currentProject) return null;
	const trimmed = name.trim();
	if (!trimmed) return null;

	if (currentProject.isLocal || !shouldSyncProject()) {
		const localBranch: ProjectBranch = {
			id: crypto.randomUUID(),
			projectId: currentProject.id,
			name: trimmed,
			forkedFromId: forkFromBranchId ?? null,
			createdBy: 'local',
			createdAt: new Date().toISOString()
		};
		currentProject.branches = [...(currentProject.branches ?? []), localBranch];
		debounceAutoSave();
		return localBranch;
	}

	try {
		const response = await authFetch(`/api/projects/${currentProject.id}/branches`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: trimmed,
				forkFromBranchId: forkFromBranchId ?? undefined
			})
		});

		if (!response.ok) {
			throw new Error('Failed to create branch');
		}

		const data = await response.json();
		const branch = mapApiBranch(data.branch);
		currentProject.branches = [...(currentProject.branches ?? []), branch];
		debounceAutoSave();
		return branch;
	} catch (error) {
		console.error('Failed to create branch:', error);
		return null;
	}
}

export async function renameProjectBranch(branchId: string, name: string): Promise<boolean> {
	if (!currentProject) return false;
	const trimmed = name.trim();
	if (!trimmed) return false;

	if (currentProject.isLocal || !shouldSyncProject()) {
		currentProject.branches = (currentProject.branches ?? []).map((branch) =>
			branch.id === branchId ? { ...branch, name: trimmed } : branch
		);
		debounceAutoSave();
		return true;
	}

	try {
		const response = await authFetch(`/api/projects/${currentProject.id}/branches/${branchId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: trimmed })
		});
		if (!response.ok) throw new Error('Failed to rename branch');

		currentProject.branches = (currentProject.branches ?? []).map((branch) =>
			branch.id === branchId ? { ...branch, name: trimmed } : branch
		);
		debounceAutoSave();
		return true;
	} catch (error) {
		console.error('Failed to rename branch:', error);
		return false;
	}
}

export async function deleteProjectBranch(branchId: string): Promise<boolean> {
	if (!currentProject) return false;
	const projectRef = currentProject;
	const previousActiveBranchId = getActiveBranchId(currentProject);
	const remainingBranches = (currentProject.branches ?? []).filter((branch) => branch.id !== branchId);
	if (remainingBranches.length === 0) return false;

	if (currentProject.isLocal || !shouldSyncProject()) {
		currentProject.branches = remainingBranches;
		if (previousActiveBranchId === branchId) {
			currentProject.activeBranchId = remainingBranches[0].id;
		}
		debounceAutoSave();
		return true;
	}

	try {
		const response = await authFetch(`/api/projects/${projectRef.id}/branches/${branchId}`, {
			method: 'DELETE'
		});
		if (!response.ok) throw new Error('Failed to delete branch');

		if (previousActiveBranchId === branchId) {
			const nextBranchId = remainingBranches[0].id;
			const switched = await setActiveBranch(nextBranchId);
			if (!switched) {
				throw new Error('Failed to switch to remaining branch');
			}
		}

		if (!currentProject) {
			throw new Error('Project state unavailable after branch deletion');
		}
		currentProject.branches = remainingBranches;
		debounceAutoSave();
		return true;
	} catch (error) {
		// Server deletion may have succeeded even if local switch failed: reload current project state.
		const fallbackBranchId =
			remainingBranches.find((branch) => branch.id !== branchId)?.id ??
			previousActiveBranchId ??
			undefined;
		if (projectRef.id && fallbackBranchId) {
			const reloaded = await loadProjectById(projectRef.id, fallbackBranchId);
			if (reloaded) {
				currentProject = reloaded;
			}
		}
		console.error('Failed to delete branch:', error);
		return false;
	}
}

export async function getItemHistory(limit = 50, offset = 0): Promise<ItemChange[]> {
	if (!currentProject || currentProject.isLocal || !shouldSyncProject()) {
		return [];
	}

	const branchId = getActiveBranchId(currentProject);
	if (!branchId) return [];

	try {
		const response = await authFetch(
			`/api/projects/${currentProject.id}/branches/${branchId}/history?limit=${limit}&offset=${offset}`
		);
		if (!response.ok) throw new Error('Failed to fetch change history');

		const data = await response.json();
		return (data.changes ?? []).map((change: ItemChange) => ({
			...change,
			createdAt: new Date(change.createdAt).toISOString()
		}));
	} catch (error) {
		console.error('Failed to load item history:', error);
		return [];
	}
}

export async function revertHistoryChanges(changeIds: string[]): Promise<boolean> {
	if (!currentProject || changeIds.length === 0 || currentProject.isLocal || !shouldSyncProject()) {
		return false;
	}

	const branchId = getActiveBranchId(currentProject);
	if (!branchId) return false;

	try {
		const response = await authFetch(`/api/projects/${currentProject.id}/branches/${branchId}/revert`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ changeIds })
		});
		if (!response.ok) throw new Error('Failed to revert changes');

		await setActiveBranch(branchId);
		return true;
	} catch (error) {
		console.error('Failed to revert history changes:', error);
		return false;
	}
}

export async function removeProject(id: string): Promise<void> {
	if (useRemote()) {
		try {
			await authFetch(`/api/projects/${id}`, { method: 'DELETE' });
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

export async function duplicateProject(id: string): Promise<ProjectMeta | null> {
	// Check if it's a local project
	const local = await loadLocalProject(id);
	const isLocal = local?.isLocal === true || !useRemote();

	if (isLocal && local) {
		// Local project: deep-clone with new UUIDs
		const now = new Date().toISOString();
		const newId = crypto.randomUUID();
		const clone: Project = {
			...JSON.parse(JSON.stringify(local)),
			id: newId,
			name: `${local.name} (copy)`,
			createdAt: now,
			updatedAt: now,
			isLocal: true,
			items: local.items.map((item) => ({
				...item,
				id: crypto.randomUUID()
			}))
		};
		await saveLocalProject(clone);

		// Copy thumbnail if exists
		const thumb = await getThumbnail(id);
		if (thumb) {
			await saveThumbnail(newId, thumb);
		}

		return {
			id: newId,
			name: clone.name,
			createdAt: clone.createdAt,
			updatedAt: clone.updatedAt,
			isLocal: true,
			thumbnailUrl: null,
			floorplanUrl: null,
			memberCount: 0
		};
	}

	// Cloud project: call API
	try {
		const response = await authFetch(`/api/projects/${id}/duplicate`, { method: 'POST' });
		if (!response.ok) throw new Error('Failed to duplicate project');
		const data = await response.json();
		return {
			id: data.project.id,
			name: data.project.name,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			isLocal: false,
			thumbnailUrl: null,
			floorplanUrl: null,
			memberCount: 1
		};
	} catch (error) {
		console.error('Failed to duplicate project:', error);
		return null;
	}
}

export function createProject(name?: string) {
	currentProject = createNewProject(name);
	saveLocalProject(currentProject);

	if (useRemote()) {
		void authFetch('/api/projects', {
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
			void authFetch(`/api/projects/${currentProject.id}`, {
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
			void authFetch(`/api/projects/${currentProject.id}/floorplan`, {
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
			void authFetch(`/api/projects/${currentProject.id}/floorplan`, {
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
		const branchId = getActiveBranchId(currentProject);
		if (!branchId) return null;

		const newItem: Item = {
			...item,
			id: crypto.randomUUID()
		};
		currentProject.items = [...currentProject.items, newItem];
		debounceAutoSave();
		const baseUrl = getBranchItemsBase(currentProject);
		if (!baseUrl) return newItem;

		if (shouldSyncProject()) {
			void authFetch(baseUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildItemPayload(newItem))
			});
		} else if (shouldQueueProject()) {
			queueChange({
				type: 'create',
				entity: 'item',
				projectId: currentProject.id,
				branchId,
				data: buildItemPayload(newItem)
			});
		}

		return newItem;
	}
	return null;
}

export function updateItem(id: string, updates: Partial<Item>) {
	if (currentProject) {
		const branchId = getActiveBranchId(currentProject);
		if (!branchId) return;

		currentProject.items = currentProject.items.map((item) =>
			item.id === id ? { ...item, ...updates } : item
		);
		debounceAutoSave();
		const baseUrl = getBranchItemsBase(currentProject);
		if (!baseUrl) return;

		const updatedItem = currentProject.items.find((item) => item.id === id);
		if (!updatedItem) return;

		if (shouldSyncProject()) {
			void authFetch(`${baseUrl}/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildItemPayload(updatedItem))
			});
		} else if (shouldQueueProject()) {
			queueChange({
				type: 'update',
				entity: 'item',
				projectId: currentProject.id,
				branchId,
				entityId: id,
				data: buildItemPayload(updatedItem)
			});
		}
	}
}

export function deleteItem(id: string) {
	if (currentProject) {
		const branchId = getActiveBranchId(currentProject);
		if (!branchId) return;

		currentProject.items = currentProject.items.filter((item) => item.id !== id);
		debounceAutoSave();
		const baseUrl = getBranchItemsBase(currentProject);
		if (!baseUrl) return;

		if (shouldSyncProject()) {
			void authFetch(`${baseUrl}/${id}`, {
				method: 'DELETE'
			});
		} else if (shouldQueueProject()) {
			queueChange({
				type: 'delete',
				entity: 'item',
				projectId: currentProject.id,
				branchId,
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
		const branchId = getActiveBranchId(currentProject);
		if (!branchId) return null;

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
			const baseUrl = getBranchItemsBase(currentProject);
			if (!baseUrl) return newItem;

			if (shouldSyncProject()) {
				void authFetch(baseUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(buildItemPayload(newItem))
				});
			} else if (shouldQueueProject()) {
				queueChange({
					type: 'create',
					entity: 'item',
					projectId: currentProject.id,
					branchId,
					data: buildItemPayload(newItem)
				});
			}

			return newItem;
		}
	}
	return null;
}

export async function uploadItemImage(itemId: string, file: File): Promise<ItemImage | null> {
	if (!currentProject) return null;
	const branchId = getActiveBranchId(currentProject);
	if (!branchId) return null;

	if (currentProject.isLocal || !shouldSyncProject()) {
		// Local: read as data URL and store in item's images array
		const dataUrl = await new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});

		const item = currentProject.items.find((i) => i.id === itemId);
		if (!item) return null;

		const existingImages = item.images ?? [];
		const newImage: ItemImage = {
			id: crypto.randomUUID(),
			filename: file.name,
			originalName: file.name,
			mimeType: file.type,
			sizeBytes: file.size,
			sortOrder: existingImages.length,
			url: dataUrl,
			thumbUrl: dataUrl
		};

		currentProject.items = currentProject.items.map((i) =>
			i.id === itemId ? { ...i, images: [...existingImages, newImage] } : i
		);
		debounceAutoSave();
		return newImage;
	}

	// Cloud: upload via API
	const formData = new FormData();
	formData.set('file', file);

	try {
		const response = await authFetch(
			`/api/projects/${currentProject.id}/branches/${branchId}/items/${itemId}/images`,
			{ method: 'POST', body: formData }
		);
		if (!response.ok) throw new Error('Failed to upload image');

		const data = await response.json();
		const apiImage: ApiItemImage = {
			...data.image,
			projectId: currentProject.id,
			itemId
		};
		const newImage = mapApiItemImage(apiImage);

		currentProject.items = currentProject.items.map((i) =>
			i.id === itemId ? { ...i, images: [...(i.images ?? []), newImage] } : i
		);
		return newImage;
	} catch (err) {
		console.error('Failed to upload item image:', err);
		return null;
	}
}

export async function deleteItemImage(itemId: string, imageId: string): Promise<boolean> {
	if (!currentProject) return false;
	const branchId = getActiveBranchId(currentProject);
	if (!branchId) return false;

	if (currentProject.isLocal || !shouldSyncProject()) {
		currentProject.items = currentProject.items.map((i) =>
			i.id === itemId
				? { ...i, images: (i.images ?? []).filter((img) => img.id !== imageId) }
				: i
		);
		debounceAutoSave();
		return true;
	}

	try {
		const response = await authFetch(
			`/api/projects/${currentProject.id}/branches/${branchId}/items/${itemId}/images/${imageId}`,
			{ method: 'DELETE' }
		);
		if (!response.ok) throw new Error('Failed to delete image');

		currentProject.items = currentProject.items.map((i) =>
			i.id === itemId
				? { ...i, images: (i.images ?? []).filter((img) => img.id !== imageId) }
				: i
		);
		return true;
	} catch (err) {
		console.error('Failed to delete item image:', err);
		return false;
	}
}

export async function reorderItemImages(itemId: string, imageIds: string[]): Promise<boolean> {
	if (!currentProject) return false;
	const branchId = getActiveBranchId(currentProject);
	if (!branchId) return false;

	// Reorder locally
	const item = currentProject.items.find((i) => i.id === itemId);
	if (!item?.images) return false;

	const reordered = imageIds
		.map((id, index) => {
			const img = item.images!.find((i) => i.id === id);
			return img ? { ...img, sortOrder: index } : null;
		})
		.filter((img): img is ItemImage => img !== null);

	currentProject.items = currentProject.items.map((i) =>
		i.id === itemId ? { ...i, images: reordered } : i
	);

	if (currentProject.isLocal || !shouldSyncProject()) {
		debounceAutoSave();
		return true;
	}

	try {
		await authFetch(
			`/api/projects/${currentProject.id}/branches/${branchId}/items/${itemId}/images/reorder`,
			{
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ imageIds })
			}
		);
		return true;
	} catch (err) {
		console.error('Failed to reorder item images:', err);
		return false;
	}
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
			void authFetch(`/api/projects/${currentProject.id}`, {
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
			void authFetch(`/api/projects/${currentProject.id}`, {
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

// ============================================================================
// Floorplan Analysis (Walls & Doors)
// ============================================================================

export type Wall = {
	id: string;
	start: [number, number];
	end: [number, number];
	thickness?: number;
};

export type Door = {
	id: string;
	type: 'door';
	position: [number, number];
	width: number;
	wall_id?: string;
};

export type Window = {
	id: string;
	type: 'window';
	position: [number, number];
	width: number;
	wall_id?: string;
};

export type Room = {
	id: string;
	type: string;
	polygon: [number, number][];
	area_sqm?: number;
	dimensions?: { width: number; height: number };
	label?: string;
};

export type Scale = {
	pixels_per_meter: number;
	reference_length?: number;
	unit?: string;
};

type FloorplanAnalysisState = {
	loaded: boolean;
	walls: Wall[];
	doors: Door[];
	windows: Window[];
	rooms: Room[];
	scale: Scale | null;
	visible: boolean;
};

let floorplanAnalysis = $state<FloorplanAnalysisState>({
	loaded: false,
	walls: [],
	doors: [],
	windows: [],
	rooms: [],
	scale: null,
	visible: true
});

/**
 * Load floorplan analysis data from API
 */
export async function loadFloorplanAnalysis(projectId: string): Promise<void> {
	try {
		const response = await authFetch(`/api/projects/${projectId}/floorplan-analysis`);
		if (!response.ok) {
			console.warn('Failed to load floorplan analysis:', response.statusText);
			floorplanAnalysis = {
				loaded: true,
				walls: [],
				doors: [],
				windows: [],
				rooms: [],
				scale: null,
				visible: false
			};
			return;
		}

		const result = await response.json();

		if (result.exists && result.data) {
			floorplanAnalysis = {
				loaded: true,
				walls: result.data.walls || [],
				doors: result.data.doors || [],
				windows: result.data.windows || [],
				rooms: result.data.rooms || [],
				scale: result.data.scale || null,
				visible: true
			};
			console.log(
				`[FloorplanAnalysis] Loaded: ${result.summary?.walls_count || 0} walls, ${result.summary?.doors_count || 0} doors`
			);
		} else {
			floorplanAnalysis = {
				loaded: true,
				walls: [],
				doors: [],
				windows: [],
				rooms: [],
				scale: null,
				visible: false
			};
			console.log('[FloorplanAnalysis] No analysis data available');
		}
	} catch (err) {
		console.error('[FloorplanAnalysis] Failed to load:', err);
		floorplanAnalysis = {
			loaded: true,
			walls: [],
			doors: [],
			windows: [],
			rooms: [],
			scale: null,
			visible: false
		};
	}
}

/**
 * Get current floorplan analysis state
 */
export function getFloorplanAnalysis(): FloorplanAnalysisState {
	return floorplanAnalysis;
}

/**
 * Check if walls/doors layer is visible
 */
export function isWallsDoorsVisible(): boolean {
	return floorplanAnalysis.visible && floorplanAnalysis.loaded;
}

/**
 * Toggle walls/doors layer visibility
 */
export function toggleWallsDoors(): void {
	floorplanAnalysis.visible = !floorplanAnalysis.visible;
}

/**
 * Set walls/doors layer visibility
 */
export function setWallsDoorsVisible(visible: boolean): void {
	floorplanAnalysis.visible = visible;
}

/**
 * Check if floorplan analysis data is available
 */
export function hasFloorplanAnalysis(): boolean {
	return (
		floorplanAnalysis.loaded &&
		(floorplanAnalysis.walls.length > 0 ||
			floorplanAnalysis.doors.length > 0 ||
			floorplanAnalysis.windows.length > 0 ||
			floorplanAnalysis.rooms.length > 0)
	);
}
