import { getDB } from './db';
import type { DBProject, DBItem, DBFloorplan, ProjectWithRole, ProjectRole } from './types';

export async function getUserProjects(userId: string): Promise<ProjectWithRole[]> {
	const db = getDB();
	const projects = await db`
		SELECT p.*, pm.role
		FROM projects p
		JOIN project_members pm ON p.id = pm.project_id
		WHERE pm.user_id = ${userId}
		ORDER BY p.updated_at DESC
	`;
	return projects as ProjectWithRole[];
}

export async function getProjectById(projectId: string): Promise<DBProject | null> {
	const db = getDB();
	const [project] = await db`
		SELECT * FROM projects WHERE id = ${projectId}
	`;
	return (project as DBProject) ?? null;
}

export async function getProjectRole(
	projectId: string,
	userId: string
): Promise<ProjectRole | null> {
	const db = getDB();
	const [member] = await db`
		SELECT role FROM project_members
		WHERE project_id = ${projectId} AND user_id = ${userId}
	`;
	return member?.role ?? null;
}

export async function createProject(
	ownerId: string,
	name: string,
	currency: string = 'EUR',
	gridSize: number = 20,
	id?: string
): Promise<DBProject> {
	const db = getDB();
	const [project] = id
		? await db`
				INSERT INTO projects (id, owner_id, name, currency, grid_size)
				VALUES (${id}, ${ownerId}, ${name}, ${currency}, ${gridSize})
				RETURNING *
			`
		: await db`
				INSERT INTO projects (owner_id, name, currency, grid_size)
				VALUES (${ownerId}, ${name}, ${currency}, ${gridSize})
				RETURNING *
			`;

	// Add owner as project member
	await db`
		INSERT INTO project_members (project_id, user_id, role)
		VALUES (${project.id}, ${ownerId}, 'owner')
	`;

	return project as DBProject;
}

export async function updateProject(
	projectId: string,
	data: { name?: string; currency?: string; gridSize?: number }
): Promise<DBProject> {
	const db = getDB();
	const [project] = await db`
		UPDATE projects SET
			name = COALESCE(${data.name ?? null}, name),
			currency = COALESCE(${data.currency ?? null}, currency),
			grid_size = COALESCE(${data.gridSize ?? null}, grid_size),
			updated_at = NOW()
		WHERE id = ${projectId}
		RETURNING *
	`;
	return project as DBProject;
}

export async function deleteProject(projectId: string): Promise<void> {
	const db = getDB();
	await db`DELETE FROM projects WHERE id = ${projectId}`;
}

export async function getProjectItems(projectId: string): Promise<DBItem[]> {
	const db = getDB();
	const items = await db`
		SELECT * FROM items WHERE project_id = ${projectId}
		ORDER BY created_at ASC
	`;
	return items as DBItem[];
}

export async function getProjectFloorplan(projectId: string): Promise<DBFloorplan | null> {
	const db = getDB();
	const [floorplan] = await db`
		SELECT * FROM floorplans WHERE project_id = ${projectId}
		ORDER BY created_at DESC LIMIT 1
	`;
	return (floorplan as DBFloorplan) ?? null;
}
