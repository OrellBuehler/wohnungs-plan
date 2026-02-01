import { eq, desc, asc, and } from 'drizzle-orm';
import { getDB, projects, projectMembers, items, floorplans, type Project, type Item, type Floorplan } from './db';
import type { ProjectWithRole, ProjectRole } from './types';

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
