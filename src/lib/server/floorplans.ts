import { getDB } from './db';
import { config } from './env';
import type { DBFloorplan } from './types';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

export async function createFloorplan(
	projectId: string,
	data: {
		filename: string;
		originalName: string;
		mimeType: string;
		sizeBytes: number;
		scale?: number;
		referenceLength?: number;
	}
): Promise<DBFloorplan> {
	const db = getDB();

	// Delete existing floorplan for this project
	const [existing] = await db`
		SELECT filename FROM floorplans WHERE project_id = ${projectId}
	`;
	if (existing) {
		await deleteFloorplanFile(projectId, existing.filename);
		await db`DELETE FROM floorplans WHERE project_id = ${projectId}`;
	}

	const [floorplan] = await db`
		INSERT INTO floorplans (
			project_id, filename, original_name, mime_type, size_bytes, scale, reference_length
		) VALUES (
			${projectId}, ${data.filename}, ${data.originalName}, ${data.mimeType},
			${data.sizeBytes}, ${data.scale ?? null}, ${data.referenceLength ?? null}
		)
		RETURNING *
	`;

	await db`UPDATE projects SET updated_at = NOW() WHERE id = ${projectId}`;

	return floorplan as DBFloorplan;
}

export async function updateFloorplanScale(
	floorplanId: string,
	scale: number,
	referenceLength: number
): Promise<DBFloorplan> {
	const db = getDB();
	const [floorplan] = await db`
		UPDATE floorplans SET
			scale = ${scale},
			reference_length = ${referenceLength},
			updated_at = NOW()
		WHERE id = ${floorplanId}
		RETURNING *
	`;
	return floorplan as DBFloorplan;
}

export async function deleteFloorplan(projectId: string): Promise<void> {
	const db = getDB();
	const [floorplan] = await db`
		SELECT filename FROM floorplans WHERE project_id = ${projectId}
	`;
	if (floorplan) {
		await deleteFloorplanFile(projectId, floorplan.filename);
		await db`DELETE FROM floorplans WHERE project_id = ${projectId}`;
	}
}

export function getFloorplanDir(projectId: string): string {
	return join(config.uploads.dir, 'floorplans', projectId);
}

export function getFloorplanPath(projectId: string, filename: string): string {
	return join(getFloorplanDir(projectId), filename);
}

export async function saveFloorplanFile(
	projectId: string,
	filename: string,
	data: Buffer
): Promise<void> {
	const dir = getFloorplanDir(projectId);
	await mkdir(dir, { recursive: true });
	await writeFile(getFloorplanPath(projectId, filename), data);
}

async function deleteFloorplanFile(projectId: string, filename: string): Promise<void> {
	try {
		await unlink(getFloorplanPath(projectId, filename));
	} catch {
		// File may not exist
	}
}
