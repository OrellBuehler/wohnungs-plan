import sharp from 'sharp';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '$lib/server/env';
import { getProjectFloorplan } from '$lib/server/projects';
import { getFloorplanPath } from '$lib/server/floorplans';
import { getBranchItems } from '$lib/server/items';
import { getDefaultBranch } from '$lib/server/branches';
import type { Item } from '$lib/server/db';
import { logger } from '$lib/server/logger';

const THUMBNAIL_WIDTH = 800;
const THUMBNAIL_HEIGHT = 600;

export function getThumbnailsDir(): string {
	return join(config.uploads.dir, 'thumbnails');
}

export function getThumbnailPath(projectId: string): string {
	return join(getThumbnailsDir(), `${projectId}.png`);
}

/**
 * Generate a thumbnail for a project by rendering the floorplan and items.
 * Falls back to a simple placeholder if no floorplan exists.
 */
export async function generateProjectThumbnail(projectId: string): Promise<Buffer> {
	// Try to get floorplan as base
	const floorplan = await getProjectFloorplan(projectId);
	let baseImage: sharp.Sharp | null = null;

	if (floorplan) {
		try {
			const floorplanPath = getFloorplanPath(projectId, floorplan.filename);
			const floorplanData = await readFile(floorplanPath);
			baseImage = sharp(floorplanData);
		} catch (err) {
			logger.warn(`[Thumbnail] Could not load floorplan for ${projectId}:`, err);
		}
	}

	// If we have a floorplan, resize it
	if (baseImage) {
		return baseImage
			.resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
				fit: 'inside',
				withoutEnlargement: true,
				background: { r: 255, g: 255, b: 255, alpha: 1 }
			})
			.png()
			.toBuffer();
	}

	// No floorplan - create a simple canvas with items
	const defaultBranch = await getDefaultBranch(projectId);
	if (!defaultBranch) {
		// No branch - return placeholder
		return createPlaceholderThumbnail();
	}

	const items = await getBranchItems(projectId, defaultBranch.id);
	const placedItems = items.filter(
		(item): item is PlacedItem => item.x !== null && item.y !== null
	);

	if (placedItems.length === 0) {
		// No placed items - return placeholder
		return createPlaceholderThumbnail();
	}

	// Calculate bounds of all items
	const bounds = calculateItemBounds(placedItems);
	if (!bounds) {
		return createPlaceholderThumbnail();
	}

	// Create canvas with items rendered as colored rectangles
	return renderItemsToCanvas(placedItems, bounds);
}

/**
 * Save a generated thumbnail to disk
 */
export async function saveProjectThumbnail(projectId: string, imageData: Buffer): Promise<void> {
	const thumbnailsDir = getThumbnailsDir();
	await mkdir(thumbnailsDir, { recursive: true });
	await writeFile(getThumbnailPath(projectId), imageData);
}

/**
 * Generate and save a project thumbnail in one step
 */
export async function generateAndSaveThumbnail(projectId: string): Promise<void> {
	const thumbnailData = await generateProjectThumbnail(projectId);
	await saveProjectThumbnail(projectId, thumbnailData);
}

function createPlaceholderThumbnail(): Promise<Buffer> {
	// Create a simple gray placeholder with text
	const svg = `
		<svg width="${THUMBNAIL_WIDTH}" height="${THUMBNAIL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
			<rect width="100%" height="100%" fill="#f3f4f6"/>
			<text x="50%" y="50%" font-family="Arial" font-size="24" fill="#9ca3af"
				text-anchor="middle" dominant-baseline="middle">
				No preview available
			</text>
		</svg>
	`;

	return sharp(Buffer.from(svg)).png().toBuffer();
}

type PlacedItem = Item & { x: number; y: number };

function calculateItemBounds(items: PlacedItem[]): {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
	width: number;
	height: number;
} | null {
	if (items.length === 0) return null;

	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const item of items) {
		const x = item.x ?? 0;
		const y = item.y ?? 0;

		// Simple bounding box (ignoring rotation for simplicity)
		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x + item.width);
		maxY = Math.max(maxY, y + item.height);
	}

	return {
		minX,
		minY,
		maxX,
		maxY,
		width: maxX - minX,
		height: maxY - minY
	};
}

async function renderItemsToCanvas(
	items: PlacedItem[],
	bounds: { minX: number; minY: number; width: number; height: number }
): Promise<Buffer> {
	// Add padding
	const padding = 50;
	const canvasWidth = bounds.width + padding * 2;
	const canvasHeight = bounds.height + padding * 2;

	// Calculate scale to fit in thumbnail
	const scale = Math.min(THUMBNAIL_WIDTH / canvasWidth, THUMBNAIL_HEIGHT / canvasHeight);

	const scaledWidth = Math.round(canvasWidth * scale);
	const scaledHeight = Math.round(canvasHeight * scale);

	// Build SVG with items
	const rects = items
		.map((item) => {
			const x = ((item.x! - bounds.minX + padding) * scale).toFixed(2);
			const y = ((item.y! - bounds.minY + padding) * scale).toFixed(2);
			const w = (item.width * scale).toFixed(2);
			const h = (item.height * scale).toFixed(2);

			return `<rect x="${x}" y="${y}" width="${w}" height="${h}"
				fill="${item.color || '#3b82f6'}" stroke="#1e40af" stroke-width="1" opacity="0.8"/>`;
		})
		.join('\n');

	const svg = `
		<svg width="${scaledWidth}" height="${scaledHeight}" xmlns="http://www.w3.org/2000/svg">
			<rect width="100%" height="100%" fill="#ffffff"/>
			${rects}
		</svg>
	`;

	return sharp(Buffer.from(svg)).png().toBuffer();
}
