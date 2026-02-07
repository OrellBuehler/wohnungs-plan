import { randomUUID } from 'crypto';
import type { RequestHandler } from './$types';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { config } from '$lib/server/env';
import { validateAccessToken } from '$lib/server/oauth';
import { getProjectRole, getUserProjects } from '$lib/server/projects';
import {
	createItem,
	deleteItem,
	getBranchItems,
	getItemById,
	updateItem
} from '$lib/server/items';
import { createBranch, getBranchById, listProjectBranches } from '$lib/server/branches';

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
			description: 'Create a new branch for a project, optionally forked from an existing branch.',
			inputSchema: {
				project_id: z.string().uuid(),
				name: z.string().min(1),
				fork_from_branch_id: z.string().uuid().optional()
			}
		},
		async ({ project_id, name, fork_from_branch_id }) => {
			await ensureProjectRole(project_id, 'editor');
			if (fork_from_branch_id) {
				await ensureBranch(project_id, fork_from_branch_id);
			}
			const branch = await createBranch(project_id, userId, name, fork_from_branch_id ?? null);
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
			description: 'List furniture items for a specific project branch.',
			inputSchema: {
				project_id: z.string().uuid(),
				branch_id: z.string().uuid()
			}
		},
		async ({ project_id, branch_id }) => {
			await ensureProjectRole(project_id, 'viewer');
			await ensureBranch(project_id, branch_id);
			const branchItems = await getBranchItems(project_id, branch_id);
			return asText(
				branchItems.map((item) => ({
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
					updated_at: item.updatedAt?.toISOString()
				}))
			);
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
