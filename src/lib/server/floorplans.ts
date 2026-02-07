import { eq } from 'drizzle-orm';
import { getDB, floorplans, projects, type Floorplan } from './db';
import { config } from './env';
import { mkdir, writeFile, unlink, copyFile } from 'node:fs/promises';
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
): Promise<Floorplan> {
	const db = getDB();

	// Delete existing floorplan for this project
	const [existing] = await db
		.select({ filename: floorplans.filename })
		.from(floorplans)
		.where(eq(floorplans.projectId, projectId));

	if (existing) {
		await deleteFloorplanFile(projectId, existing.filename);
		await db.delete(floorplans).where(eq(floorplans.projectId, projectId));
	}

	const [floorplan] = await db
		.insert(floorplans)
		.values({
			projectId,
			filename: data.filename,
			originalName: data.originalName,
			mimeType: data.mimeType,
			sizeBytes: data.sizeBytes,
			scale: data.scale ?? null,
			referenceLength: data.referenceLength ?? null
		})
		.returning();

	await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));

	return floorplan;
}

export async function updateFloorplanScale(
	floorplanId: string,
	scale: number,
	referenceLength: number
): Promise<Floorplan> {
	const db = getDB();
	const [floorplan] = await db
		.update(floorplans)
		.set({
			scale,
			referenceLength,
			updatedAt: new Date()
		})
		.where(eq(floorplans.id, floorplanId))
		.returning();
	return floorplan;
}

export async function deleteFloorplan(projectId: string): Promise<void> {
	const db = getDB();
	const [floorplan] = await db
		.select({ filename: floorplans.filename })
		.from(floorplans)
		.where(eq(floorplans.projectId, projectId));

	if (floorplan) {
		await deleteFloorplanFile(projectId, floorplan.filename);
		await db.delete(floorplans).where(eq(floorplans.projectId, projectId));
	}
}

export function getFloorplanDir(projectId: string): string {
	return join(config.uploads.dir, 'floorplans', projectId);
}

export function getFloorplanPath(projectId: string, filename: string): string {
	return join(getFloorplanDir(projectId), filename);
}

export async function saveFloorplanFile(projectId: string, filename: string, data: Buffer): Promise<void> {
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

export async function copyFloorplan(sourceProjectId: string, targetProjectId: string): Promise<Floorplan | null> {
	const db = getDB();
	const [source] = await db
		.select()
		.from(floorplans)
		.where(eq(floorplans.projectId, sourceProjectId));

	if (!source) return null;

	// Copy file on disk
	const srcPath = getFloorplanPath(sourceProjectId, source.filename);
	const destDir = getFloorplanDir(targetProjectId);
	await mkdir(destDir, { recursive: true });
	const destPath = getFloorplanPath(targetProjectId, source.filename);
	await copyFile(srcPath, destPath);

	// Insert new floorplan record
	const [floorplan] = await db
		.insert(floorplans)
		.values({
			projectId: targetProjectId,
			filename: source.filename,
			originalName: source.originalName,
			mimeType: source.mimeType,
			sizeBytes: source.sizeBytes,
			scale: source.scale,
			referenceLength: source.referenceLength
		})
		.returning();

	return floorplan;
}
