import { randomUUID } from 'crypto';
import { readFile, unlink, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { RequestHandler } from './$types';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { config } from '$lib/server/env';
import { validateAccessToken } from '$lib/server/oauth';
import { getProjectById, getProjectDisabledTools, getProjectFloorplan, getProjectRole, getUserProjects } from '$lib/server/projects';
import {
	createItem,
	deleteItem,
	getBranchItems,
	getItemById,
	insertHistoryEntries,
	updateItem
} from '$lib/server/items';
import { createBranch, getBranchById, getDefaultBranch, listProjectBranches } from '$lib/server/branches';
import { getFloorplanPath } from '$lib/server/floorplans';
import {
	getItemImages,
	createItemImage,
	saveItemImageFile,
	generateThumbnail,
	deleteItemImage,
	getImagesByItems,
	getItemImagePath,
	getItemImageThumbPath
} from '$lib/server/item-images';
import { EXT_BY_MIME } from '$lib/server/image-utils';
import { downloadImageFromUrl } from '$lib/server/url-download';
import { checkRateLimit } from '$lib/server/rate-limit';
import {
	getThumbnailPath,
	generateAndSaveThumbnail
} from '$lib/server/thumbnails';
import {
	saveFloorplanAnalysis,
	getFloorplanAnalysis,
	type FloorplanAnalysisData
} from '$lib/server/floorplan-analyses';
import {
	getItemsInRoom,
	getRoomAvailableSpace,
	checkPlacement,
	suggestPlacement
} from '$lib/server/spatial-queries';
import { getCommentsByBranch, addReply, getCommentById } from '$lib/server/comments';

const MCP_SERVER_NAME = 'wohnungs-plan';
const MCP_SERVER_VERSION = '3.0.0';
const REQUIRED_SCOPE = 'mcp:access';

type SessionState = {
	transport: WebStandardStreamableHTTPServerTransport;
	userId: string;
	lastAccess: number;
};

const sessionTransports = new Map<string, SessionState>();

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

setInterval(() => {
	const now = Date.now();
	for (const [sessionId, state] of sessionTransports) {
		if (now - state.lastAccess > SESSION_TIMEOUT_MS) {
			sessionTransports.delete(sessionId);
			if (typeof state.transport.close === 'function') {
				state.transport.close();
			}
		}
	}
}, 5 * 60 * 1000).unref();

function getBaseUrl(url: URL): string {
	const base = config.publicUrl || url.origin;
	return base.replace(/\/$/, '');
}

function getResourceMetadataUrl(url: URL): string {
	return `${getBaseUrl(url)}/.well-known/oauth-protected-resource/api/mcp`;
}

function buildWwwAuthenticateHeader(
	resourceMetadataUrl: string,
	options?: { error?: string; errorDescription?: string }
): string {
	const parts = [
		`Bearer realm="${MCP_SERVER_NAME}"`,
		`resource_metadata="${resourceMetadataUrl}"`,
		`scope="${REQUIRED_SCOPE}"`
	];

	if (options?.error) {
		parts.push(`error="${options.error}"`);
	}
	if (options?.errorDescription) {
		const escaped = options.errorDescription.replace(/"/g, "'");
		parts.push(`error_description="${escaped}"`);
	}

	return parts.join(', ');
}

function unauthorizedResponse(url: URL, message: string): Response {
	return new Response(JSON.stringify({ error: 'unauthorized', message }), {
		status: 401,
		headers: {
			'Content-Type': 'application/json',
			'WWW-Authenticate': buildWwwAuthenticateHeader(getResourceMetadataUrl(url), {
				error: 'invalid_token',
				errorDescription: message
			})
		}
	});
}

function jsonRpcError(status: number, code: number, message: string, id: unknown = null): Response {
	return new Response(
		JSON.stringify({
			jsonrpc: '2.0',
			id,
			error: { code, message }
		}),
		{
			status,
			headers: { 'Content-Type': 'application/json' }
		}
	);
}

function containsInitializeRequest(body: unknown): boolean {
	if (Array.isArray(body)) {
		return body.some((message) => isInitializeRequest(message));
	}
	return isInitializeRequest(body);
}

async function authenticateRequest(request: Request): Promise<{ userId: string; clientId: string } | null> {
	const authHeader = request.headers.get('authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return null;
	}

	const token = authHeader.slice(7);
	return (await validateAccessToken(token)) ?? null;
}

function createMcpServer(userId: string): McpServer {
	const server = new McpServer({
		name: MCP_SERVER_NAME,
		version: MCP_SERVER_VERSION
	});

	const asText = (payload: unknown) => ({
		content: [
			{
				type: 'text' as const,
				text: JSON.stringify(payload, null, 2)
			}
		]
	});

	async function ensureProjectRole(
		projectId: string,
		requiredRole: 'viewer' | 'editor' | 'owner'
	): Promise<'owner' | 'editor' | 'viewer'> {
		const role = await getProjectRole(projectId, userId);
		if (!role) {
			throw new Error('Permission denied. You do not have access to this project.');
		}

		if (requiredRole === 'viewer') {
			return role;
		}

		if (requiredRole === 'editor' && role === 'viewer') {
			throw new Error('Permission denied. You need editor or owner role.');
		}

		if (requiredRole === 'owner' && role !== 'owner') {
			throw new Error('Permission denied. You need owner role.');
		}

		return role;
	}

	async function checkToolEnabled(toolName: string, projectId: string): Promise<void> {
		const disabled = await getProjectDisabledTools(projectId);
		if (disabled.includes(toolName)) {
			throw new Error(
				`The '${toolName}' tool is disabled for this project. The project owner can enable it in project settings.`
			);
		}
	}

	async function ensureBranch(projectId: string, branchId: string): Promise<void> {
		const branch = await getBranchById(projectId, branchId);
		if (!branch) {
			throw new Error('Branch not found for this project.');
		}
	}

	server.registerTool(
		'list_projects',
		{
			description:
				'List all projects the user has access to, including project details (name, currency, grid size, role).',
			inputSchema: {}
		},
		async () => {
			const projects = await getUserProjects(userId);
			return asText(
				projects.map((project) => ({
					id: project.id,
					name: project.name,
					currency: project.currency,
					gridSize: project.gridSize,
					role: project.role,
					createdAt: project.createdAt?.toISOString(),
					updatedAt: project.updatedAt?.toISOString()
				}))
			);
		}
	);

	server.registerTool(
		'list_branches',
		{
			description: 'List branches for a project.',
			inputSchema: {
				project_id: z.string().uuid()
			}
		},
		async ({ project_id }) => {
			await checkToolEnabled('list_branches', project_id);
			await ensureProjectRole(project_id, 'viewer');
			const projectBranches = await listProjectBranches(project_id);
			return asText(
				projectBranches.map((branch) => ({
					id: branch.id,
					project_id: branch.projectId,
					name: branch.name,
					forked_from_id: branch.forkedFromId,
					created_by: branch.createdBy,
					created_at: branch.createdAt?.toISOString()
				}))
			);
		}
	);

	server.registerTool(
		'create_branch',
		{
			description:
				'Create a new branch for a project. By default, copies all items from the main branch. Use fork_from_branch_id to fork from a different branch, or set fork_from_branch_id to null to create an empty branch.',
			inputSchema: {
				project_id: z.string().uuid(),
				name: z.string().min(1),
				fork_from_branch_id: z.string().uuid().nullable().optional()
			}
		},
		async ({ project_id, name, fork_from_branch_id }) => {
			await checkToolEnabled('create_branch', project_id);
			await ensureProjectRole(project_id, 'editor');

			let forkId: string | null;
			if (fork_from_branch_id === null) {
				forkId = null;
			} else if (fork_from_branch_id) {
				await ensureBranch(project_id, fork_from_branch_id);
				forkId = fork_from_branch_id;
			} else {
				const defaultBranch = await getDefaultBranch(project_id);
				forkId = defaultBranch?.id ?? null;
			}

			const branch = await createBranch(project_id, userId, name, forkId);
			return asText({
				id: branch.id,
				project_id: branch.projectId,
				name: branch.name,
				forked_from_id: branch.forkedFromId,
				created_by: branch.createdBy,
				created_at: branch.createdAt?.toISOString()
			});
		}
	);

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
				color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
				price: z.number().positive().optional(),
				priceCurrency: z.string().optional(),
				productUrl: z.string().url().optional(),
				shape: z.enum(['rectangle', 'l-shape']).optional(),
				cutoutWidth: z.number().positive().optional(),
				cutoutHeight: z.number().positive().optional(),
				cutoutCorner: z
					.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right'])
					.optional()
			}
		},
		async ({ project_id, branch_id, ...itemData }) => {
			await checkToolEnabled('add_furniture_item', project_id);
			await ensureProjectRole(project_id, 'editor');
			await ensureBranch(project_id, branch_id);
			const item = await createItem(project_id, branch_id, userId, {
				...itemData,
				x: null,
				y: null
			}, { viaMcp: true });
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
			description: 'Update an existing furniture item in a project branch. When setting position (x, y), first check get_floorplan_analysis for architectural constraints. The UI will show orange highlighting if items collide with walls/doors/windows. Avoid placing items that block doorways (respect door swing areas) or intersect walls. Position coordinates are in canvas pixels.',
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
				color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
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

			const item = await updateItem(project_id, branch_id, item_id, userId, updates, { viaMcp: true });
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

			const deleted = await deleteItem(project_id, branch_id, item_id, userId, { viaMcp: true });
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
				const item = await createItem(project_id, branch_id, userId, {
					...itemData,
					x: itemData.x ?? null,
					y: itemData.y ?? null
				}, { viaMcp: true });
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
				const item = await updateItem(project_id, branch_id, item_id, userId, data, { viaMcp: true });
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
			description: 'List furniture items for a specific project branch, including image data for each item.',
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

			// Try to load existing thumbnail
			try {
				await access(thumbPath);
				thumbnailData = await readFile(thumbPath);
			} catch {
				// Thumbnail doesn't exist - generate it
				try {
					await generateAndSaveThumbnail(project_id);
					thumbnailData = await readFile(thumbPath);
					wasGenerated = true;
				} catch (err) {
					console.error(`[MCP] Failed to generate thumbnail for ${project_id}:`, err);
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

	server.registerTool(
		'add_item_image_from_url',
		{
			description:
				'Download an image from an HTTPS URL and attach it to a furniture item. Useful for adding product photos. The image is downloaded server-side with security protections (HTTPS only, no private IPs, max 5MB).',
			inputSchema: {
				project_id: z.string().uuid(),
				branch_id: z.string().uuid(),
				item_id: z.string().uuid(),
				image_url: z.string().url()
			}
		},
		async ({ project_id, branch_id, item_id, image_url }) => {
			await checkToolEnabled('add_item_image_from_url', project_id);
			await ensureProjectRole(project_id, 'editor');
			await ensureBranch(project_id, branch_id);

			const item = await getItemById(project_id, branch_id, item_id);
			if (!item) {
				throw new Error('Item not found in this branch.');
			}

			if (!checkRateLimit(`mcp-download:${userId}`)) {
				throw new Error('Rate limit exceeded. Max 5 image downloads per 15 minutes.');
			}

			const result = await downloadImageFromUrl(image_url);

			const ext = EXT_BY_MIME[result.mimeType];
			const filename = `${randomUUID()}.${ext}`;

			await saveItemImageFile(project_id, item_id, filename, result.buffer);
			await generateThumbnail(project_id, item_id, filename);

			// Extract display name from URL path
			let originalName = 'image.' + ext;
			try {
				const urlPath = new URL(image_url).pathname;
				const lastSegment = urlPath.split('/').pop();
				if (lastSegment && lastSegment.includes('.')) {
					originalName = decodeURIComponent(lastSegment);
				}
			} catch {
				// keep default
			}

			let image;
			try {
				image = await createItemImage(project_id, item_id, {
					filename,
					originalName,
					mimeType: result.mimeType,
					sizeBytes: result.sizeBytes
				});
			} catch (err) {
				// Clean up orphaned files if DB insert fails
				await unlink(getItemImagePath(project_id, item_id, filename)).catch(() => {});
				await unlink(getItemImageThumbPath(project_id, item_id, filename)).catch(() => {});
				throw err;
			}

			await insertHistoryEntries([
				{
					projectId: project_id,
					branchId: branch_id,
					itemId: item_id,
					userId,
					action: 'update',
					field: 'image',
					oldValue: null,
					newValue: originalName,
					viaMcp: true
				}
			]);

			return asText({
				id: image.id,
				item_id: item_id,
				filename: image.originalName,
				mime_type: image.mimeType,
				size_bytes: image.sizeBytes,
				url: `/api/projects/${project_id}/branches/${branch_id}/items/${item_id}/images/${image.id}`,
				thumb_url: `/api/projects/${project_id}/branches/${branch_id}/items/${item_id}/images/${image.id}/thumbnail`
			});
		}
	);

	server.registerTool(
		'list_item_images',
		{
			description: 'List all images attached to a furniture item.',
			inputSchema: {
				project_id: z.string().uuid(),
				branch_id: z.string().uuid(),
				item_id: z.string().uuid()
			}
		},
		async ({ project_id, branch_id, item_id }) => {
			await checkToolEnabled('list_item_images', project_id);
			await ensureProjectRole(project_id, 'viewer');
			await ensureBranch(project_id, branch_id);

			const item = await getItemById(project_id, branch_id, item_id);
			if (!item) {
				throw new Error('Item not found in this branch.');
			}

			const images = await getItemImages(item_id);
			return asText(
				images.map((img) => ({
					id: img.id,
					filename: img.originalName,
					mime_type: img.mimeType,
					size_bytes: img.sizeBytes,
					sort_order: img.sortOrder,
					url: `/api/projects/${project_id}/branches/${branch_id}/items/${item_id}/images/${img.id}`,
					thumb_url: `/api/projects/${project_id}/branches/${branch_id}/items/${item_id}/images/${img.id}/thumbnail`,
					created_at: img.createdAt?.toISOString()
				}))
			);
		}
	);

	server.registerTool(
		'delete_item_image',
		{
			description: 'Delete an image from a furniture item.',
			inputSchema: {
				project_id: z.string().uuid(),
				branch_id: z.string().uuid(),
				item_id: z.string().uuid(),
				image_id: z.string().uuid()
			}
		},
		async ({ project_id, branch_id, item_id, image_id }) => {
			await checkToolEnabled('delete_item_image', project_id);
			await ensureProjectRole(project_id, 'editor');
			await ensureBranch(project_id, branch_id);

			const item = await getItemById(project_id, branch_id, item_id);
			if (!item) {
				throw new Error('Item not found in this branch.');
			}

			// Get image info before deletion for history
			const images = await getItemImages(item_id);
			const image = images.find((img) => img.id === image_id);
			if (!image) {
				throw new Error('Image not found for this item.');
			}

			const deleted = await deleteItemImage(project_id, item_id, image_id);
			if (!deleted) {
				throw new Error('Image not found for this item.');
			}

			await insertHistoryEntries([
				{
					projectId: project_id,
					branchId: branch_id,
					itemId: item_id,
					userId,
					action: 'update',
					field: 'image',
					oldValue: image.originalName ?? image.filename,
					newValue: null,
					viaMcp: true
				}
			]);

			return asText({ success: true, image_id });
		}
	);

	server.registerTool(
		'save_floorplan_analysis',
		{
			description:
				'Save structured floorplan analysis data extracted from the floorplan image. This data enables intelligent furniture placement by detecting collisions with walls, doors, and windows. When saved, the UI will automatically show architectural elements as a visual layer and prevent users from placing furniture in invalid positions (e.g., blocking doorways, intersecting walls). The AI agent should first get the floorplan image using get_project_preview, analyze it using their vision capabilities, then save the structured data here. This approach costs the user nothing extra since they are already paying for their AI usage. IMPORTANT: Provide accurate door positions and widths - the system uses door swing radius for collision detection.',
			inputSchema: {
				project_id: z.string().uuid(),
				analysis: z.object({
					rooms: z
						.array(
							z.object({
								id: z.string(),
								type: z.string(),
								polygon: z.array(z.tuple([z.number().min(-10000).max(100000), z.number().min(-10000).max(100000)])),
								area_sqm: z.number().min(0).max(10000).optional(),
								dimensions: z.object({ width: z.number().min(0).max(100000), height: z.number().min(0).max(100000) }).optional(),
								label: z.string().optional()
							})
						)
						.describe('Array of room objects with boundaries and metadata'),
					walls: z
						.array(
							z.object({
								id: z.string(),
								start: z.tuple([z.number().min(-10000).max(100000), z.number().min(-10000).max(100000)]),
								end: z.tuple([z.number().min(-10000).max(100000), z.number().min(-10000).max(100000)]),
								thickness: z.number().min(0).max(1000).optional()
							})
						)
						.describe('Array of wall segments'),
					openings: z
						.array(
							z.object({
								id: z.string(),
								type: z.enum(['door', 'window']),
								position: z.tuple([z.number().min(-10000).max(100000), z.number().min(-10000).max(100000)]),
								width: z.number().min(0).max(10000).optional(),
								wall_id: z.string().optional()
							})
						)
						.describe('Array of doors and windows'),
					scale: z
						.object({
							pixels_per_meter: z.number().min(0.01).max(10000),
							reference_length: z.number().min(0).optional(),
							unit: z.string().optional()
						})
						.optional()
						.describe('Scale information for converting pixels to real-world units'),
					metadata: z
						.object({
							confidence: z.number().min(0).max(1).optional(),
							notes: z.string().optional(),
							analyzed_with: z.string().optional()
						})
						.passthrough()
						.optional()
						.describe('Optional metadata about the analysis')
				})
			}
		},
		async ({ project_id, analysis }) => {
			await checkToolEnabled('save_floorplan_analysis', project_id);
			await ensureProjectRole(project_id, 'editor');

			const saved = await saveFloorplanAnalysis(
				project_id,
				userId,
				analysis as FloorplanAnalysisData
			);

			return asText({
				success: true,
				analysis_id: saved.id,
				rooms_saved: analysis.rooms.length,
				walls_saved: analysis.walls.length,
				openings_saved: analysis.openings.length,
				message: 'Floorplan analysis saved successfully. Future furniture placement can use this spatial data.'
			});
		}
	);

	server.registerTool(
		'get_floorplan_analysis',
		{
			description:
				'Retrieve previously saved floorplan analysis data. Returns structured information about rooms, walls, doors, and windows that was extracted from the floorplan image. Use this to understand the spatial layout before suggesting furniture placement. When architectural data exists, the UI provides real-time collision detection: items turn orange when dragged over walls/doors/windows, helping users avoid invalid placements. Consider door swing areas (typically 90-degree arcs) when suggesting furniture positions - avoid placing items that would block door operation.',
			inputSchema: {
				project_id: z.string().uuid()
			}
		},
		async ({ project_id }) => {
			await checkToolEnabled('get_floorplan_analysis', project_id);
			await ensureProjectRole(project_id, 'viewer');

			const analysis = await getFloorplanAnalysis(project_id);

			if (!analysis) {
				return asText({
					success: false,
					message:
						'No floorplan analysis found. Use get_project_preview to view the floorplan image, analyze it with your vision capabilities, then save the structured data with save_floorplan_analysis.'
				});
			}

			return asText({
				success: true,
				analysis,
				summary: {
					rooms_count: analysis.rooms.length,
					walls_count: analysis.walls.length,
					openings_count: analysis.openings.length,
					has_scale: !!analysis.scale
				}
			});
		}
	);

	server.registerTool(
		'get_room_contents',
		{
			description:
				'List all furniture items placed within a specific room. Requires a floorplan analysis to exist (rooms must be defined). Uses the item center point to determine room membership.',
			inputSchema: {
				project_id: z.string().uuid(),
				branch_id: z.string().uuid(),
				room_id: z.string()
			}
		},
		async ({ project_id, branch_id, room_id }) => {
			await checkToolEnabled('get_room_contents', project_id);
			await ensureProjectRole(project_id, 'viewer');
			await ensureBranch(project_id, branch_id);

			const analysis = await getFloorplanAnalysis(project_id);
			if (!analysis) {
				throw new Error('No floorplan analysis found. Run save_floorplan_analysis first.');
			}

			const room = analysis.rooms.find((r) => r.id === room_id);
			if (!room) {
				throw new Error(
					`Room "${room_id}" not found. Available rooms: ${analysis.rooms.map((r) => `${r.id} (${r.type})`).join(', ')}`
				);
			}

			const branchItems = await getBranchItems(project_id, branch_id);
			const roomItems = getItemsInRoom(room_id, branchItems, analysis);

			return asText({
				room_id: room.id,
				room_type: room.type,
				room_label: room.label ?? room.type,
				item_count: roomItems.length,
				items: roomItems.map((item) => ({
					id: item.id,
					name: item.name,
					width: item.width,
					height: item.height,
					x: item.x,
					y: item.y,
					rotation: item.rotation
				}))
			});
		}
	);

	server.registerTool(
		'get_available_space',
		{
			description:
				'Calculate the available floor space in a room by subtracting furniture footprints from the room area. Returns both pixel and real-world (sqm) measurements when scale data exists.',
			inputSchema: {
				project_id: z.string().uuid(),
				branch_id: z.string().uuid(),
				room_id: z.string()
			}
		},
		async ({ project_id, branch_id, room_id }) => {
			await checkToolEnabled('get_available_space', project_id);
			await ensureProjectRole(project_id, 'viewer');
			await ensureBranch(project_id, branch_id);

			const analysis = await getFloorplanAnalysis(project_id);
			if (!analysis) {
				throw new Error('No floorplan analysis found. Run save_floorplan_analysis first.');
			}

			const branchItems = await getBranchItems(project_id, branch_id);
			const space = getRoomAvailableSpace(room_id, branchItems, analysis);
			if (!space) {
				throw new Error(
					`Room "${room_id}" not found. Available rooms: ${analysis.rooms.map((r) => `${r.id} (${r.type})`).join(', ')}`
				);
			}

			const room = analysis.rooms.find((r) => r.id === room_id)!;
			return asText({
				room_id: room.id,
				room_type: room.type,
				room_label: room.label ?? room.type,
				...space
			});
		}
	);

	server.registerTool(
		'check_placement',
		{
			description:
				'Validate a proposed furniture placement BEFORE committing it. Checks for collisions with walls, door swing zones, and existing items. Returns whether the placement is valid and lists any issues. Always use this before update_furniture_item to avoid placing items in invalid positions.',
			inputSchema: {
				project_id: z.string().uuid(),
				branch_id: z.string().uuid(),
				x: z.number(),
				y: z.number(),
				width: z.number().positive(),
				height: z.number().positive(),
				rotation: z.number().default(0),
				exclude_item_id: z
					.string()
					.uuid()
					.optional()
					.describe(
						'Item ID to exclude from collision checks (use when repositioning an existing item)'
					)
			}
		},
		async ({ project_id, branch_id, x, y, width, height, rotation, exclude_item_id }) => {
			await checkToolEnabled('check_placement', project_id);
			await ensureProjectRole(project_id, 'viewer');
			await ensureBranch(project_id, branch_id);

			const analysis = await getFloorplanAnalysis(project_id);
			const branchItems = await getBranchItems(project_id, branch_id);
			const filteredItems = exclude_item_id
				? branchItems.filter((i) => i.id !== exclude_item_id)
				: branchItems;

			const result = checkPlacement(x, y, width, height, rotation, filteredItems, analysis);
			return asText(result);
		}
	);

	server.registerTool(
		'suggest_placement',
		{
			description:
				'Find a valid position for a furniture item within a specific room. Uses grid search to find a spot that avoids walls, doors, and existing items. Returns suggested x, y, rotation or null if no valid position found. Requires floorplan analysis.',
			inputSchema: {
				project_id: z.string().uuid(),
				branch_id: z.string().uuid(),
				room_id: z.string(),
				width: z.number().positive(),
				height: z.number().positive()
			}
		},
		async ({ project_id, branch_id, room_id, width, height }) => {
			await checkToolEnabled('suggest_placement', project_id);
			await ensureProjectRole(project_id, 'viewer');
			await ensureBranch(project_id, branch_id);

			const analysis = await getFloorplanAnalysis(project_id);
			if (!analysis) {
				throw new Error('No floorplan analysis found. Run save_floorplan_analysis first.');
			}

			const branchItems = await getBranchItems(project_id, branch_id);
			const suggestion = suggestPlacement(room_id, width, height, branchItems, analysis);

			if (!suggestion) {
				return asText({
					found: false,
					message: `No valid position found for a ${width}x${height} item in room "${room_id}". The room may be too full.`
				});
			}

			return asText({
				found: true,
				x: suggestion.x,
				y: suggestion.y,
				rotation: suggestion.rotation,
				message: `Suggested position: (${suggestion.x}, ${suggestion.y}) with rotation ${suggestion.rotation}°`
			});
		}
	);

	server.registerTool(
		'list_comments',
		{
			description:
				'List all comment threads for a project branch. Each comment has a type (canvas pin or item-attached) and contains threaded replies. The first reply in each thread is the original message. Comments can be resolved or unresolved.',
			inputSchema: {
				project_id: z.string().uuid(),
				branch_id: z.string().uuid()
			}
		},
		async ({ project_id, branch_id }) => {
			await checkToolEnabled('list_comments', project_id);
			await ensureProjectRole(project_id, 'viewer');
			await ensureBranch(project_id, branch_id);

			const threadList = await getCommentsByBranch(project_id, branch_id);
			return asText(
				threadList.map((c) => ({
					id: c.id,
					type: c.type,
					item_id: c.itemId,
					x: c.x,
					y: c.y,
					resolved: c.resolved,
					author_name: c.authorName,
					created_at: c.createdAt?.toISOString(),
					updated_at: c.updatedAt?.toISOString(),
					replies: c.replies.map((r) => ({
						id: r.id,
						author_name: r.authorName,
						body: r.body,
						created_at: r.createdAt?.toISOString()
					}))
				}))
			);
		}
	);

	server.registerTool(
		'add_comment_reply',
		{
			description:
				'Add a reply to an existing comment thread. Use list_comments first to find the comment ID you want to reply to.',
			inputSchema: {
				project_id: z.string().uuid(),
				comment_id: z.string().uuid(),
				body: z.string().min(1)
			}
		},
		async ({ project_id, comment_id, body }) => {
			await checkToolEnabled('add_comment_reply', project_id);
			await ensureProjectRole(project_id, 'editor');

			const comment = await getCommentById(comment_id);
			if (!comment || comment.projectId !== project_id) {
				throw new Error('Comment not found in this project.');
			}

			const reply = await addReply({
				commentId: comment_id,
				authorId: userId,
				body
			});

			return asText({
				id: reply.id,
				comment_id: reply.commentId,
				author_name: reply.authorName,
				body: reply.body,
				created_at: reply.createdAt?.toISOString()
			});
		}
	);

	// --- MCP Resources ---

	server.resource(
		'project-summary',
		new ResourceTemplate('project://{project_id}/summary', { list: undefined }),
		{
			description:
				'Project metadata including name, dimensions, currency, grid size, branch count, and item count.',
			mimeType: 'application/json'
		},
		async (uri, vars) => {
			const projectId = String(vars.project_id);
			await ensureProjectRole(projectId, 'viewer');
			const project = await getProjectById(projectId);
			if (!project) throw new Error('Project not found');

			const projectBranches = await listProjectBranches(projectId);
			const defaultBranch = await getDefaultBranch(projectId);
			let itemCount = 0;
			if (defaultBranch) {
				const branchItems = await getBranchItems(projectId, defaultBranch.id);
				itemCount = branchItems.length;
			}

			return {
				contents: [
					{
						uri: uri.href,
						mimeType: 'application/json',
						text: JSON.stringify(
							{
								id: project.id,
								name: project.name,
								currency: project.currency,
								grid_size: project.gridSize,
								branch_count: projectBranches.length,
								default_branch_id: defaultBranch?.id ?? null,
								item_count: itemCount,
								created_at: project.createdAt?.toISOString(),
								updated_at: project.updatedAt?.toISOString()
							},
							null,
							2
						)
					}
				]
			};
		}
	);

	server.resource(
		'floorplan-analysis',
		new ResourceTemplate('project://{project_id}/floorplan-analysis', { list: undefined }),
		{
			description:
				'Cached floorplan analysis with rooms, walls, openings, and scale data. Returns null if no analysis exists.',
			mimeType: 'application/json'
		},
		async (uri, vars) => {
			const projectId = String(vars.project_id);
			await ensureProjectRole(projectId, 'viewer');
			const analysis = await getFloorplanAnalysis(projectId);
			return {
				contents: [
					{
						uri: uri.href,
						mimeType: 'application/json',
						text: JSON.stringify(analysis, null, 2)
					}
				]
			};
		}
	);

	server.resource(
		'branch-items',
		new ResourceTemplate('project://{project_id}/branches/{branch_id}/items', {
			list: undefined
		}),
		{
			description:
				'Complete furniture inventory for a branch, including positions and dimensions.',
			mimeType: 'application/json'
		},
		async (uri, vars) => {
			const projectId = String(vars.project_id);
			const branchId = String(vars.branch_id);
			await ensureProjectRole(projectId, 'viewer');
			await ensureBranch(projectId, branchId);
			const branchItems = await getBranchItems(projectId, branchId);
			return {
				contents: [
					{
						uri: uri.href,
						mimeType: 'application/json',
						text: JSON.stringify(
							branchItems.map((item) => ({
								id: item.id,
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
								shape: item.shape
							})),
							null,
							2
						)
					}
				]
			};
		}
	);

	// --- MCP Prompts ---

	server.registerPrompt(
		'furnish-room',
		{
			description:
				'Guided workflow to furnish a specific room with appropriate furniture items.',
			argsSchema: {
				project_id: z.string().uuid(),
				branch_id: z.string().uuid(),
				room_id: z.string(),
				style: z
					.string()
					.optional()
					.describe('Furniture style preference (e.g., modern, minimalist, cozy)')
			}
		},
		async ({ project_id, branch_id, room_id, style }) => {
			await ensureProjectRole(project_id, 'viewer');

			const analysis = await getFloorplanAnalysis(project_id);
			if (!analysis) {
				return {
					messages: [
						{
							role: 'user' as const,
							content: {
								type: 'text' as const,
								text: `No floorplan analysis found for project ${project_id}. Please first use get_project_preview to view the floorplan, then save_floorplan_analysis to extract room data.`
							}
						}
					]
				};
			}

			const room = analysis.rooms.find((r) => r.id === room_id);
			if (!room) {
				return {
					messages: [
						{
							role: 'user' as const,
							content: {
								type: 'text' as const,
								text: `Room "${room_id}" not found. Available rooms: ${analysis.rooms.map((r) => `${r.id} (${r.type}${r.label ? ': ' + r.label : ''})`).join(', ')}`
							}
						}
					]
				};
			}

			const branchItems = await getBranchItems(project_id, branch_id);
			const roomItemCount = getItemsInRoom(room_id, branchItems, analysis).length;

			const scaleInfo = analysis.scale
				? `Scale: ${analysis.scale.pixels_per_meter} pixels/meter.`
				: 'No scale data available — dimensions are in pixels.';

			const styleNote = style ? `Style preference: ${style}.` : '';

			return {
				messages: [
					{
						role: 'user' as const,
						content: {
							type: 'text' as const,
							text: `Please furnish the ${room.type}${room.label ? ` (${room.label})` : ''} in project ${project_id}, branch ${branch_id}.

Room details:
- ID: ${room.id}
- Type: ${room.type}
- Area: ${room.area_sqm ? room.area_sqm + ' sqm' : 'unknown'}
- Dimensions: ${room.dimensions ? `${room.dimensions.width}x${room.dimensions.height}` : 'see polygon'}
- Current items in room: ${roomItemCount}
- Walls nearby: ${analysis.walls.length} total
- Doors/windows nearby: ${analysis.openings.length} total
${scaleInfo}
${styleNote}

Steps:
1. Use get_available_space to check how much room you have
2. Decide which furniture items are appropriate for a ${room.type}
3. Use batch_add_items to add all items at once
4. Use check_placement for each item before setting positions
5. Use batch_update_items to place all items with valid positions
6. Use get_project_preview to verify the final layout looks good`
						}
					}
				]
			};
		}
	);

	server.registerPrompt(
		'optimize-layout',
		{
			description:
				'Analyze the current furniture layout and suggest improvements for better space usage, traffic flow, and aesthetics.',
			argsSchema: {
				project_id: z.string().uuid(),
				branch_id: z.string().uuid()
			}
		},
		async ({ project_id, branch_id }) => {
			await ensureProjectRole(project_id, 'viewer');
			await ensureBranch(project_id, branch_id);

			const analysis = await getFloorplanAnalysis(project_id);
			const branchItems = await getBranchItems(project_id, branch_id);

			const placedItems = branchItems.filter((i) => i.x !== null && i.y !== null);
			const unplacedItems = branchItems.filter((i) => i.x === null || i.y === null);

			return {
				messages: [
					{
						role: 'user' as const,
						content: {
							type: 'text' as const,
							text: `Please analyze and optimize the furniture layout for project ${project_id}, branch ${branch_id}.

Current state:
- Total items: ${branchItems.length}
- Placed on canvas: ${placedItems.length}
- In inventory (unplaced): ${unplacedItems.length}
- Rooms defined: ${analysis ? analysis.rooms.length : 'No floorplan analysis — run save_floorplan_analysis first'}
- Walls: ${analysis ? analysis.walls.length : 'unknown'}
- Doors/windows: ${analysis ? analysis.openings.length : 'unknown'}

Steps:
1. Use get_project_preview to see the current layout
2. For each room, use get_room_contents and get_available_space
3. Identify issues: blocked doors, overlapping items, wasted space, poor traffic flow
4. Use check_placement to validate proposed new positions
5. Use batch_update_items to reposition items
6. Use get_project_preview to verify improvements`
						}
					}
				]
			};
		}
	);

	server.registerPrompt(
		'shopping-list',
		{
			description:
				'Generate a furniture shopping list based on empty or under-furnished rooms.',
			argsSchema: {
				project_id: z.string().uuid(),
				branch_id: z.string().uuid(),
				budget: z.string().optional().describe('Budget constraint (e.g., "500 EUR")')
			}
		},
		async ({ project_id, branch_id, budget }) => {
			await ensureProjectRole(project_id, 'viewer');
			await ensureBranch(project_id, branch_id);

			const analysis = await getFloorplanAnalysis(project_id);
			const branchItems = await getBranchItems(project_id, branch_id);

			const totalSpent = branchItems
				.filter((i) => i.price !== null)
				.reduce((sum, i) => sum + (i.price ?? 0), 0);

			const budgetNote = budget
				? `Budget: ${budget}. Already spent: ${totalSpent} EUR.`
				: `Current total: ${totalSpent} EUR.`;

			return {
				messages: [
					{
						role: 'user' as const,
						content: {
							type: 'text' as const,
							text: `Generate a furniture shopping list for project ${project_id}, branch ${branch_id}.

${budgetNote}
Current item count: ${branchItems.length}
Rooms: ${analysis ? analysis.rooms.map((r) => `${r.type}${r.label ? ` (${r.label})` : ''}`).join(', ') : 'No floorplan analysis — analyze first'}

Steps:
1. Use get_project_preview to see the current layout
2. For each room, use get_room_contents to see what's already there
3. Identify what's missing (e.g., bedroom without bed, living room without sofa)
4. Suggest specific items with estimated dimensions and prices
5. Use batch_add_items to add suggested items to inventory
6. Summarize the total estimated cost`
						}
					}
				]
			};
		}
	);

	return server;
}

async function createSessionTransport(userId: string): Promise<WebStandardStreamableHTTPServerTransport> {
	let transport!: WebStandardStreamableHTTPServerTransport;
	transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: () => randomUUID(),
		onsessioninitialized: (sessionId) => {
			sessionTransports.set(sessionId, { transport, userId, lastAccess: Date.now() });
		},
		onsessionclosed: (sessionId) => {
			sessionTransports.delete(sessionId);
		}
	});

	transport.onclose = () => {
		if (transport.sessionId) {
			sessionTransports.delete(transport.sessionId);
		}
	};

	const server = createMcpServer(userId);
	await server.connect(transport);
	return transport;
}

function getSessionTransport(sessionId: string, userId: string): WebStandardStreamableHTTPServerTransport | null {
	const session = sessionTransports.get(sessionId);
	if (!session || session.userId !== userId) {
		return null;
	}
	session.lastAccess = Date.now();
	return session.transport;
}

export const POST: RequestHandler = async ({ request, url }) => {
	const auth = await authenticateRequest(request);
	if (!auth) {
		return unauthorizedResponse(url, 'Missing or invalid bearer token.');
	}

	const sessionId = request.headers.get('mcp-session-id');

	if (sessionId) {
		const transport = getSessionTransport(sessionId, auth.userId);
		if (!transport) {
			return jsonRpcError(404, -32001, 'Session not found');
		}
		return transport.handleRequest(request);
	}

	// No session — validate this is an initialize request using a clone
	// so the original body remains unconsumed for the transport
	let body: unknown;
	try {
		body = await request.clone().json();
	} catch {
		return jsonRpcError(400, -32700, 'Parse error: Invalid JSON');
	}

	if (!containsInitializeRequest(body)) {
		return jsonRpcError(400, -32600, 'Invalid Request: Initialization required');
	}

	const transport = await createSessionTransport(auth.userId);
	return transport.handleRequest(request);
};

export const GET: RequestHandler = async ({ request, url }) => {
	const auth = await authenticateRequest(request);
	if (!auth) {
		return unauthorizedResponse(url, 'Missing or invalid bearer token.');
	}

	const sessionId = request.headers.get('mcp-session-id');
	if (!sessionId) {
		return jsonRpcError(400, -32000, 'Missing mcp-session-id header');
	}

	const transport = getSessionTransport(sessionId, auth.userId);
	if (!transport) {
		return jsonRpcError(404, -32001, 'Session not found');
	}

	return transport.handleRequest(request);
};

export const DELETE: RequestHandler = async ({ request, url }) => {
	const auth = await authenticateRequest(request);
	if (!auth) {
		return unauthorizedResponse(url, 'Missing or invalid bearer token.');
	}

	const sessionId = request.headers.get('mcp-session-id');
	if (!sessionId) {
		return jsonRpcError(400, -32000, 'Missing mcp-session-id header');
	}

	const transport = getSessionTransport(sessionId, auth.userId);
	if (!transport) {
		return jsonRpcError(404, -32001, 'Session not found');
	}

	return transport.handleRequest(request);
};
