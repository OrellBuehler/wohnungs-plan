import { z } from 'zod';
import { readFile, access } from 'node:fs/promises';
import { createItem, deleteItem, getBranchItems, getItemById, updateItem } from '$lib/server/items';
import { getImagesByItems } from '$lib/server/item-images';
import { getThumbnailPath, generateAndSaveThumbnail } from '$lib/server/thumbnails';
import { logger } from '$lib/server/logger';
import type { McpServer, ToolHelpers } from '../types';

export function registerFurnitureTools(server: McpServer, helpers: ToolHelpers): void {
	const { getUserId, ensureProjectRole, checkToolEnabled, ensureBranch, asText } = helpers;

	server.registerTool(
		'add_furniture_item',
		{
			description:
				'Add a new furniture item to a project branch. The item is added to the inventory (not placed on canvas).',
			inputSchema: {
				project_id: z.string().uuid(),
				branch_id: z.string().uuid(),
				name: z.string().min(1),
				width: z.number().positive(),
				height: z.number().positive(),
				color: z
					.string()
					.regex(/^#[0-9a-fA-F]{6}$/)
					.optional(),
				price: z.number().positive().optional(),
				priceCurrency: z.string().optional(),
				productUrl: z.string().url().optional(),
				shape: z.enum(['rectangle', 'l-shape']).optional(),
				cutoutWidth: z.number().positive().optional(),
				cutoutHeight: z.number().positive().optional(),
				cutoutCorner: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).optional()
			}
		},
		async ({ project_id, branch_id, ...itemData }) => {
			await checkToolEnabled('add_furniture_item', project_id);
			await ensureProjectRole(project_id, 'editor');
			await ensureBranch(project_id, branch_id);
			const item = await createItem(
				project_id,
				branch_id,
				getUserId(),
				{
					...itemData,
					x: null,
					y: null
				},
				{ viaMcp: true }
			);
			return asText({
				id: item.id,
				project_id: item.projectId,
				branch_id: item.branchId,
				name: item.name,
				width: item.width,
				height: item.height,
				x: item.x,
				y: item.y,
				rotation: item.rotation,
				color: item.color,
				price: item.price,
				price_currency: item.priceCurrency,
				product_url: item.productUrl,
				shape: item.shape,
				cutout_width: item.cutoutWidth,
				cutout_height: item.cutoutHeight,
				cutout_corner: item.cutoutCorner,
				created_at: item.createdAt?.toISOString()
			});
		}
	);

	server.registerTool(
		'update_furniture_item',
		{
			description:
				'Update an existing furniture item in a project branch. When setting position (x, y), first check get_floorplan_analysis for architectural constraints. The UI will show orange highlighting if items collide with walls/doors/windows. Avoid placing items that block doorways (respect door swing areas) or intersect walls. Position coordinates are in canvas pixels.',
			inputSchema: {
				project_id: z.string().uuid(),
				branch_id: z.string().uuid(),
				item_id: z.string().uuid(),
				name: z.string().min(1).optional(),
				width: z.number().positive().optional(),
				height: z.number().positive().optional(),
				x: z.number().nullable().optional(),
				y: z.number().nullable().optional(),
				rotation: z.number().optional(),
				color: z
					.string()
					.regex(/^#[0-9a-fA-F]{6}$/)
					.optional(),
				price: z.number().positive().nullable().optional(),
				priceCurrency: z.string().optional(),
				productUrl: z.string().url().nullable().optional(),
				shape: z.enum(['rectangle', 'l-shape']).optional(),
				cutoutWidth: z.number().positive().nullable().optional(),
				cutoutHeight: z.number().positive().nullable().optional(),
				cutoutCorner: z
					.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right'])
					.nullable()
					.optional()
			}
		},
		async ({ project_id, branch_id, item_id, ...updates }) => {
			await checkToolEnabled('update_furniture_item', project_id);
			await ensureProjectRole(project_id, 'editor');
			await ensureBranch(project_id, branch_id);

			const existing = await getItemById(project_id, branch_id, item_id);
			if (!existing) {
				throw new Error('Item not found in this branch.');
			}

			const item = await updateItem(project_id, branch_id, item_id, getUserId(), updates, {
				viaMcp: true
			});
			if (!item) {
				throw new Error('Item update failed.');
			}

			return asText({
				id: item.id,
				project_id: item.projectId,
				branch_id: item.branchId,
				name: item.name,
				width: item.width,
				height: item.height,
				x: item.x,
				y: item.y,
				rotation: item.rotation,
				color: item.color,
				price: item.price,
				price_currency: item.priceCurrency,
				product_url: item.productUrl,
				shape: item.shape,
				cutout_width: item.cutoutWidth,
				cutout_height: item.cutoutHeight,
				cutout_corner: item.cutoutCorner,
				updated_at: item.updatedAt?.toISOString()
			});
		}
	);

	server.registerTool(
		'delete_furniture_item',
		{
			description: 'Delete a furniture item from a project branch.',
			inputSchema: {
				project_id: z.string().uuid(),
				branch_id: z.string().uuid(),
				item_id: z.string().uuid()
			}
		},
		async ({ project_id, branch_id, item_id }) => {
			await checkToolEnabled('delete_furniture_item', project_id);
			await ensureProjectRole(project_id, 'editor');
			await ensureBranch(project_id, branch_id);

			const deleted = await deleteItem(project_id, branch_id, item_id, getUserId(), {
				viaMcp: true
			});
			if (!deleted) {
				throw new Error('Item not found in this branch.');
			}

			return asText({ success: true, item_id });
		}
	);

	server.registerTool(
		'batch_add_items',
		{
			description:
				'Add multiple furniture items to a project branch in one call. Each item is added to the inventory (not placed on canvas unless x/y provided). Max 50 items per call.',
			inputSchema: {
				project_id: z.string().uuid(),
				branch_id: z.string().uuid(),
				items: z
					.array(
						z.object({
							name: z.string().min(1),
							width: z.number().positive(),
							height: z.number().positive(),
							x: z.number().nullable().optional(),
							y: z.number().nullable().optional(),
							rotation: z.number().optional(),
							color: z
								.string()
								.regex(/^#[0-9a-fA-F]{6}$/)
								.optional(),
							price: z.number().positive().optional(),
							priceCurrency: z.string().optional(),
							productUrl: z.string().url().optional(),
							shape: z.enum(['rectangle', 'l-shape']).optional(),
							cutoutWidth: z.number().positive().optional(),
							cutoutHeight: z.number().positive().optional(),
							cutoutCorner: z
								.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right'])
								.optional()
						})
					)
					.min(1)
					.max(50)
			}
		},
		async ({ project_id, branch_id, items: itemsInput }) => {
			await checkToolEnabled('batch_add_items', project_id);
			await ensureProjectRole(project_id, 'editor');
			await ensureBranch(project_id, branch_id);

			const created = [];
			for (const itemData of itemsInput) {
				const item = await createItem(
					project_id,
					branch_id,
					getUserId(),
					{
						...itemData,
						x: itemData.x ?? null,
						y: itemData.y ?? null
					},
					{ viaMcp: true }
				);
				created.push({
					id: item.id,
					name: item.name,
					width: item.width,
					height: item.height,
					x: item.x,
					y: item.y
				});
			}

			return asText({
				created_count: created.length,
				items: created
			});
		}
	);

	server.registerTool(
		'batch_update_items',
		{
			description:
				'Update multiple furniture items in a single call. Useful for repositioning multiple items at once (e.g., rearranging a room). Max 50 items per call.',
			inputSchema: {
				project_id: z.string().uuid(),
				branch_id: z.string().uuid(),
				updates: z
					.array(
						z.object({
							item_id: z.string().uuid(),
							name: z.string().min(1).optional(),
							width: z.number().positive().optional(),
							height: z.number().positive().optional(),
							x: z.number().nullable().optional(),
							y: z.number().nullable().optional(),
							rotation: z.number().optional(),
							color: z
								.string()
								.regex(/^#[0-9a-fA-F]{6}$/)
								.optional(),
							price: z.number().positive().nullable().optional(),
							priceCurrency: z.string().optional(),
							productUrl: z.string().url().nullable().optional()
						})
					)
					.min(1)
					.max(50)
			}
		},
		async ({ project_id, branch_id, updates }) => {
			await checkToolEnabled('batch_update_items', project_id);
			await ensureProjectRole(project_id, 'editor');
			await ensureBranch(project_id, branch_id);

			const results = [];
			for (const { item_id, ...data } of updates) {
				const item = await updateItem(project_id, branch_id, item_id, getUserId(), data, {
					viaMcp: true
				});
				if (!item) {
					results.push({ item_id, success: false, error: 'Item not found' });
				} else {
					results.push({
						item_id: item.id,
						success: true,
						name: item.name,
						x: item.x,
						y: item.y,
						rotation: item.rotation
					});
				}
			}

			return asText({
				updated_count: results.filter((r) => r.success).length,
				failed_count: results.filter((r) => !r.success).length,
				results
			});
		}
	);

	server.registerTool(
		'list_furniture_items',
		{
			description:
				'List furniture items for a specific project branch, including image data for each item.',
			inputSchema: {
				project_id: z.string().uuid(),
				branch_id: z.string().uuid()
			}
		},
		async ({ project_id, branch_id }) => {
			await checkToolEnabled('list_furniture_items', project_id);
			await ensureProjectRole(project_id, 'viewer');
			await ensureBranch(project_id, branch_id);
			const branchItems = await getBranchItems(project_id, branch_id);

			const itemIds = branchItems.map((i) => i.id);
			const imageMap = await getImagesByItems(project_id, itemIds);

			return asText(
				branchItems.map((item) => {
					const imgs = imageMap.get(item.id) ?? [];
					return {
						id: item.id,
						project_id: item.projectId,
						branch_id: item.branchId,
						name: item.name,
						width: item.width,
						height: item.height,
						x: item.x,
						y: item.y,
						rotation: item.rotation,
						color: item.color,
						price: item.price,
						price_currency: item.priceCurrency,
						product_url: item.productUrl,
						shape: item.shape,
						cutout_width: item.cutoutWidth,
						cutout_height: item.cutoutHeight,
						cutout_corner: item.cutoutCorner,
						created_at: item.createdAt?.toISOString(),
						updated_at: item.updatedAt?.toISOString(),
						image_count: imgs.length,
						images: imgs.map((img) => ({
							id: img.id,
							filename: img.originalName,
							thumb_url: `/api/projects/${project_id}/branches/${item.branchId}/items/${item.id}/images/${img.id}/thumbnail`
						}))
					};
				})
			);
		}
	);

	server.registerTool(
		'get_project_preview',
		{
			description:
				'Get a visual preview of the project layout. Returns the project thumbnail (rendered canvas snapshot) showing the floorplan, placed items, and architectural elements (walls/doors/windows if analysis exists). If no thumbnail exists, one will be automatically generated. The image is returned as base64-encoded data that AI clients can display. Use this first to see the current layout before suggesting changes.',
			inputSchema: {
				project_id: z.string().uuid()
			}
		},
		async ({ project_id }) => {
			await checkToolEnabled('get_project_preview', project_id);
			await ensureProjectRole(project_id, 'viewer');

			const thumbPath = getThumbnailPath(project_id);
			let thumbnailData: Buffer | null = null;
			let wasGenerated = false;

			try {
				await access(thumbPath);
				thumbnailData = await readFile(thumbPath);
			} catch {
				try {
					await generateAndSaveThumbnail(project_id);
					thumbnailData = await readFile(thumbPath);
					wasGenerated = true;
				} catch (err) {
					logger.error(`[MCP] Failed to generate thumbnail for ${project_id}:`, err);
					return asText({
						error: 'Could not generate preview',
						message:
							err instanceof Error
								? err.message
								: 'Failed to generate thumbnail. The project may not have a floorplan or any placed items.'
					});
				}
			}

			if (!thumbnailData) {
				return asText({
					error: 'No preview available',
					message: 'Unable to load or generate project thumbnail.'
				});
			}

			const base64 = thumbnailData.toString('base64');
			const source = wasGenerated ? 'Generated from floorplan and items' : 'Cached thumbnail';

			return {
				content: [
					{
						type: 'text' as const,
						text: `Project preview (${source})\nSize: ${thumbnailData.length} bytes`
					},
					{
						type: 'image' as const,
						data: base64,
						mimeType: 'image/png'
					}
				]
			};
		}
	);
}
