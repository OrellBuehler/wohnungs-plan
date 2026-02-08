import { randomUUID } from 'crypto';
import { readFile, unlink, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { RequestHandler } from './$types';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { config } from '$lib/server/env';
import { validateAccessToken } from '$lib/server/oauth';
import { getProjectFloorplan, getProjectRole, getUserProjects } from '$lib/server/projects';
import {
	createItem,
	deleteItem,
	getBranchItems,
	getItemById,
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

const MCP_SERVER_NAME = 'wohnungs-plan';
const MCP_SERVER_VERSION = '2.0.0';
const REQUIRED_SCOPE = 'mcp:access';

type SessionState = {
	transport: WebStandardStreamableHTTPServerTransport;
	userId: string;
};

const sessionTransports = new Map<string, SessionState>();

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
			await ensureProjectRole(project_id, 'editor');
			await ensureBranch(project_id, branch_id);
			const item = await createItem(project_id, branch_id, userId, {
				...itemData,
				x: null,
				y: null
			});
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
			description: 'Update an existing furniture item in a project branch.',
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
			await ensureProjectRole(project_id, 'editor');
			await ensureBranch(project_id, branch_id);

			const existing = await getItemById(project_id, branch_id, item_id);
			if (!existing) {
				throw new Error('Item not found in this branch.');
			}

			const item = await updateItem(project_id, branch_id, item_id, userId, updates);
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
			await ensureProjectRole(project_id, 'editor');
			await ensureBranch(project_id, branch_id);

			const deleted = await deleteItem(project_id, branch_id, item_id, userId);
			if (!deleted) {
				throw new Error('Item not found in this branch.');
			}

			return asText({ success: true, item_id });
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
				'Get a visual preview of the project layout. Returns the project thumbnail (rendered canvas snapshot). If no thumbnail exists, one will be automatically generated from the floorplan and placed items. Useful for understanding the current spatial layout. The image is returned as base64-encoded data that AI clients can display.',
			inputSchema: {
				project_id: z.string().uuid()
			}
		},
		async ({ project_id }) => {
			await ensureProjectRole(project_id, 'viewer');

			const thumbPath = getThumbnailPath(project_id);
			let thumbnailData: Buffer | null = null;
			let wasGenerated = false;

			// Try to load existing thumbnail
			try {
				await access(thumbPath);
				thumbnailData = await readFile(thumbPath);
				console.log(`[MCP] Loaded existing thumbnail for ${project_id}`);
			} catch {
				// Thumbnail doesn't exist - generate it
				console.log(`[MCP] Generating thumbnail for ${project_id}...`);
				try {
					await generateAndSaveThumbnail(project_id);
					thumbnailData = await readFile(thumbPath);
					wasGenerated = true;
					console.log(`[MCP] Successfully generated thumbnail for ${project_id}`);
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
			await ensureProjectRole(project_id, 'editor');
			await ensureBranch(project_id, branch_id);

			const item = await getItemById(project_id, branch_id, item_id);
			if (!item) {
				throw new Error('Item not found in this branch.');
			}

			const deleted = await deleteItemImage(project_id, item_id, image_id);
			if (!deleted) {
				throw new Error('Image not found for this item.');
			}

			return asText({ success: true, image_id });
		}
	);

	server.registerTool(
		'save_floorplan_analysis',
		{
			description:
				'Save structured floorplan analysis data extracted from the floorplan image. This data helps AI understand room layouts, wall positions, doors, and windows for better furniture placement. The AI agent should first get the floorplan image using get_project_preview, analyze it themselves (using their own vision capabilities), and then save the structured data here. This costs the user nothing extra since they are already paying for their AI usage.',
			inputSchema: {
				project_id: z.string().uuid(),
				analysis: z.object({
					rooms: z
						.array(
							z.object({
								id: z.string(),
								type: z.string(),
								polygon: z.array(z.tuple([z.number(), z.number()])),
								area_sqm: z.number().optional(),
								dimensions: z.object({ width: z.number(), height: z.number() }).optional(),
								label: z.string().optional()
							})
						)
						.describe('Array of room objects with boundaries and metadata'),
					walls: z
						.array(
							z.object({
								id: z.string(),
								start: z.tuple([z.number(), z.number()]),
								end: z.tuple([z.number(), z.number()]),
								thickness: z.number().optional()
							})
						)
						.describe('Array of wall segments'),
					openings: z
						.array(
							z.object({
								id: z.string(),
								type: z.enum(['door', 'window']),
								position: z.tuple([z.number(), z.number()]),
								width: z.number().optional(),
								wall_id: z.string().optional()
							})
						)
						.describe('Array of doors and windows'),
					scale: z
						.object({
							pixels_per_meter: z.number(),
							reference_length: z.number().optional(),
							unit: z.string().optional()
						})
						.optional()
						.describe('Scale information for converting pixels to real-world units'),
					metadata: z
						.object({
							confidence: z.number().optional(),
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
				'Retrieve previously saved floorplan analysis data. Returns structured information about rooms, walls, doors, and windows that was extracted from the floorplan image. Use this to understand the spatial layout before suggesting furniture placement.',
			inputSchema: {
				project_id: z.string().uuid()
			}
		},
		async ({ project_id }) => {
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

	return server;
}

async function createSessionTransport(userId: string): Promise<WebStandardStreamableHTTPServerTransport> {
	let transport!: WebStandardStreamableHTTPServerTransport;
	transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: () => randomUUID(),
		onsessioninitialized: (sessionId) => {
			sessionTransports.set(sessionId, { transport, userId });
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
