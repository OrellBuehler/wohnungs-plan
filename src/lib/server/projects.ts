import { eq, desc, asc, and, or, sql, inArray } from 'drizzle-orm';
import { getDB, projects, projectMembers, items, floorplans, type Project, type Item, type Floorplan } from './db';
import type { ProjectWithRole, ProjectRole } from './types';
import type { ProjectMeta } from '$lib/types';
import { copyFloorplan } from './floorplans';

export async function getUserProjects(userId: string): Promise<ProjectWithRole[]> {
	const db = getDB();
	const result = await db
		.select({
			id: projects.id,
			ownerId: projects.ownerId,
			name: projects.name,
			currency: projects.currency,
			gridSize: projects.gridSize,
			createdAt: projects.createdAt,
			updatedAt: projects.updatedAt,
			role: projectMembers.role
		})
		.from(projects)
		.innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
		.where(eq(projectMembers.userId, userId))
		.orderBy(desc(projects.updatedAt));

	return result as ProjectWithRole[];
}

export async function getUserProjectsWithDetails(userId: string): Promise<ProjectMeta[]> {
	const db = getDB();

	// First get the user's projects (without floorplan join to avoid duplicates)
	const results = await db
		.select({
			id: projects.id,
			name: projects.name,
			createdAt: projects.createdAt,
			updatedAt: projects.updatedAt
		})
		.from(projects)
		.leftJoin(projectMembers, eq(projectMembers.projectId, projects.id))
		.where(or(eq(projects.ownerId, userId), eq(projectMembers.userId, userId)))
		.groupBy(projects.id)
		.orderBy(desc(projects.updatedAt));

	if (results.length === 0) {
		return [];
	}

	const projectIds = results.map((p) => p.id);

	// Get latest floorplan for each project
	const floorplanResults = await db
		.select({
			projectId: floorplans.projectId,
			filename: floorplans.filename
		})
		.from(floorplans)
		.where(inArray(floorplans.projectId, projectIds))
		.orderBy(desc(floorplans.createdAt));

	// Keep only first (latest) floorplan per project
	const floorplanMap = new Map<string, string>();
	for (const fp of floorplanResults) {
		if (!floorplanMap.has(fp.projectId)) {
			floorplanMap.set(fp.projectId, fp.filename);
		}
	}

	// Get member counts for these projects only
	const memberCounts = await db
		.select({
			projectId: projectMembers.projectId,
			count: sql<number>`count(*)`.as('count')
		})
		.from(projectMembers)
		.where(inArray(projectMembers.projectId, projectIds))
		.groupBy(projectMembers.projectId);

	const countMap = new Map(memberCounts.map((m) => [m.projectId, Number(m.count)]));

	return results.map((p) => ({
		id: p.id,
		name: p.name,
		createdAt: p.createdAt?.toISOString() ?? new Date().toISOString(),
		updatedAt: p.updatedAt?.toISOString() ?? new Date().toISOString(),
		isLocal: false,
		floorplanUrl: floorplanMap.has(p.id)
			? `/api/images/floorplans/${p.id}/${floorplanMap.get(p.id)}`
			: null,
		memberCount: countMap.get(p.id) ?? 1
	}));
}

export async function getProjectById(projectId: string): Promise<Project | null> {
	const db = getDB();
	const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
	return project ?? null;
}

export async function getProjectRole(projectId: string, userId: string): Promise<ProjectRole | null> {
	const db = getDB();
	const [member] = await db
		.select({ role: projectMembers.role })
		.from(projectMembers)
		.where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
	return (member?.role as ProjectRole) ?? null;
}

export async function createProject(
	ownerId: string,
	name: string,
	currency: string = 'EUR',
	gridSize: number = 20,
	id?: string
): Promise<Project> {
	const db = getDB();
	const [project] = await db
		.insert(projects)
		.values({
			...(id ? { id } : {}),
			ownerId,
			name,
			currency,
			gridSize
		})
		.returning();

	// Add owner as project member
	await db.insert(projectMembers).values({
		projectId: project.id,
		userId: ownerId,
		role: 'owner'
	});

	return project;
}

export async function updateProject(
	projectId: string,
	data: { name?: string; currency?: string; gridSize?: number }
): Promise<Project> {
	const db = getDB();
	const [project] = await db
		.update(projects)
		.set({
			...(data.name !== undefined && { name: data.name }),
			...(data.currency !== undefined && { currency: data.currency }),
			...(data.gridSize !== undefined && { gridSize: data.gridSize }),
			updatedAt: new Date()
		})
		.where(eq(projects.id, projectId))
		.returning();
	return project;
}

export async function deleteProject(projectId: string): Promise<void> {
	const db = getDB();
	await db.delete(projects).where(eq(projects.id, projectId));
}

export async function getProjectItems(projectId: string): Promise<Item[]> {
	const db = getDB();
	return db.select().from(items).where(eq(items.projectId, projectId)).orderBy(asc(items.createdAt));
}

export async function getProjectFloorplan(projectId: string): Promise<Floorplan | null> {
	const db = getDB();
	const [floorplan] = await db
		.select()
		.from(floorplans)
		.where(eq(floorplans.projectId, projectId))
		.orderBy(desc(floorplans.createdAt))
		.limit(1);
	return floorplan ?? null;
}

export async function duplicateProject(sourceProjectId: string, newOwnerId: string): Promise<Project> {
	const db = getDB();

	const source = await getProjectById(sourceProjectId);
	if (!source) throw new Error('Source project not found');

	// Create the new project
	const [newProject] = await db
		.insert(projects)
		.values({
			ownerId: newOwnerId,
			name: `${source.name} (copy)`,
			currency: source.currency,
			gridSize: source.gridSize
		})
		.returning();

	// Add owner as member
	await db.insert(projectMembers).values({
		projectId: newProject.id,
		userId: newOwnerId,
		role: 'owner'
	});

	// Copy all items with new UUIDs
	const sourceItems = await getProjectItems(sourceProjectId);
	if (sourceItems.length > 0) {
		await db.insert(items).values(
			sourceItems.map((item) => ({
				projectId: newProject.id,
				name: item.name,
				width: item.width,
				height: item.height,
				x: item.x,
				y: item.y,
				rotation: item.rotation,
				color: item.color,
				price: item.price,
				priceCurrency: item.priceCurrency,
				productUrl: item.productUrl,
				shape: item.shape,
				cutoutWidth: item.cutoutWidth,
				cutoutHeight: item.cutoutHeight,
				cutoutCorner: item.cutoutCorner
			}))
		);
	}

	// Copy floorplan (file + DB record)
	await copyFloorplan(sourceProjectId, newProject.id);

	return newProject;
}
