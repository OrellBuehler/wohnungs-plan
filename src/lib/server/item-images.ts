import { eq, and, inArray, asc, sql } from 'drizzle-orm';
import { getDB, itemImages } from './db';
import { config } from './env';
import { mkdir, writeFile, unlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const THUMB_SIZE = 300;
const THUMB_QUALITY = 80;

export function getItemImagesDir(projectId: string, itemId: string): string {
	return join(config.uploads.dir, 'item-images', projectId, itemId);
}

export function getItemImagePath(projectId: string, itemId: string, filename: string): string {
	return join(getItemImagesDir(projectId, itemId), filename);
}

export function getItemImageThumbPath(projectId: string, itemId: string, filename: string): string {
	return join(getItemImagesDir(projectId, itemId), `thumb_${filename}`);
}

export async function saveItemImageFile(
	projectId: string,
	itemId: string,
	filename: string,
	data: Buffer
): Promise<void> {
	const dir = getItemImagesDir(projectId, itemId);
	await mkdir(dir, { recursive: true });
	await writeFile(getItemImagePath(projectId, itemId, filename), data);
}

export async function generateThumbnail(
	projectId: string,
	itemId: string,
	filename: string
): Promise<void> {
	const sourcePath = getItemImagePath(projectId, itemId, filename);
	const thumbPath = getItemImageThumbPath(projectId, itemId, filename);

	await sharp(sourcePath)
		.resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
		.jpeg({ quality: THUMB_QUALITY })
		.toFile(thumbPath);
}

export async function getItemImages(itemId: string) {
	const db = getDB();
	return db
		.select()
		.from(itemImages)
		.where(eq(itemImages.itemId, itemId))
		.orderBy(asc(itemImages.sortOrder), asc(itemImages.createdAt));
}

export async function createItemImage(
	projectId: string,
	itemId: string,
	data: {
		filename: string;
		originalName: string;
		mimeType: string;
		sizeBytes: number;
	}
) {
	const db = getDB();

	const nextOrder = db
		.select({ val: sql<number>`coalesce(max(${itemImages.sortOrder}), -1) + 1` })
		.from(itemImages)
		.where(eq(itemImages.itemId, itemId));

	const [image] = await db
		.insert(itemImages)
		.values({
			projectId,
			itemId,
			filename: data.filename,
			originalName: data.originalName,
			mimeType: data.mimeType,
			sizeBytes: data.sizeBytes,
			sortOrder: sql`(${nextOrder})`
		})
		.returning();

	return image;
}

export async function deleteItemImage(
	projectId: string,
	itemId: string,
	imageId: string
): Promise<boolean> {
	const db = getDB();

	const [image] = await db
		.select()
		.from(itemImages)
		.where(and(eq(itemImages.id, imageId), eq(itemImages.itemId, itemId)));

	if (!image) return false;

	// Delete files from disk
	try {
		await unlink(getItemImagePath(projectId, itemId, image.filename));
	} catch {
		// File may not exist
	}
	try {
		await unlink(getItemImageThumbPath(projectId, itemId, image.filename));
	} catch {
		// Thumbnail may not exist
	}

	await db.delete(itemImages).where(eq(itemImages.id, imageId));
	return true;
}

export async function deleteAllItemImages(projectId: string, itemId: string): Promise<void> {
	const db = getDB();
	await db
		.delete(itemImages)
		.where(and(eq(itemImages.itemId, itemId), eq(itemImages.projectId, projectId)));

	// Remove directory
	try {
		await rm(getItemImagesDir(projectId, itemId), { recursive: true, force: true });
	} catch {
		// Directory may not exist
	}
}

export async function reorderItemImages(itemId: string, imageIds: string[]): Promise<void> {
	const db = getDB();
	await db.transaction(async (tx) => {
		for (let i = 0; i < imageIds.length; i++) {
			await tx
				.update(itemImages)
				.set({ sortOrder: i })
				.where(and(eq(itemImages.id, imageIds[i]), eq(itemImages.itemId, itemId)));
		}
	});
}

export async function getImagesByItems(
	projectId: string,
	itemIds: string[]
): Promise<Map<string, (typeof itemImages.$inferSelect)[]>> {
	if (itemIds.length === 0) return new Map();

	const db = getDB();
	const images = await db
		.select()
		.from(itemImages)
		.where(and(eq(itemImages.projectId, projectId), inArray(itemImages.itemId, itemIds)))
		.orderBy(asc(itemImages.sortOrder), asc(itemImages.createdAt));

	const map = new Map<string, (typeof itemImages.$inferSelect)[]>();
	for (const image of images) {
		const existing = map.get(image.itemId) ?? [];
		existing.push(image);
		map.set(image.itemId, existing);
	}
	return map;
}
