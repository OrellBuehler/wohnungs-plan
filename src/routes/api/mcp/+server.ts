import { randomUUID } from 'crypto';
import type { RequestHandler } from './$types';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { config } from '$lib/server/env';
import { validateAccessToken } from '$lib/server/oauth';
import { getProjectRole, getUserProjects } from '$lib/server/projects';
import { createItem } from '$lib/server/items';

const MCP_SERVER_NAME = 'wohnungs-plan';
const MCP_SERVER_VERSION = '1.0.0';
const REQUIRED_SCOPE = 'mcp:access';

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Mcp-Session-Id',
	'Access-Control-Expose-Headers': 'Mcp-Session-Id'
};

/** Add CORS headers to any Response */
function withCors(response: Response): Response {
	for (const [key, value] of Object.entries(CORS_HEADERS)) {
		response.headers.set(key, value);
	}
	return response;
}

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
	return withCors(new Response(JSON.stringify({ error: 'unauthorized', message }), {
		status: 401,
		headers: {
			'Content-Type': 'application/json',
			'WWW-Authenticate': buildWwwAuthenticateHeader(getResourceMetadataUrl(url), {
				error: 'invalid_token',
				errorDescription: message
			})
		}
	}));
}

function jsonRpcError(status: number, code: number, message: string, id: unknown = null): Response {
	return withCors(new Response(
		JSON.stringify({
			jsonrpc: '2.0',
			id,
			error: { code, message }
		}),
		{
			status,
			headers: { 'Content-Type': 'application/json' }
		}
	));
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

	server.registerTool(
		'list_projects',
		{
			description:
				'List all projects the user has access to, including project details (name, currency, grid size, role).',
			inputSchema: {}
		},
		async () => {
			const projects = await getUserProjects(userId);
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(
							projects.map((project) => ({
								id: project.id,
								name: project.name,
								currency: project.currency,
								gridSize: project.gridSize,
								role: project.role,
								createdAt: project.createdAt?.toISOString(),
								updatedAt: project.updatedAt?.toISOString()
							})),
							null,
							2
						)
					}
				]
			};
		}
	);

	server.registerTool(
		'add_furniture_item',
		{
			description:
				'Add a new furniture item to a project. The item is added to the inventory (not placed on canvas). Position (x, y) will be null until user places it manually.',
			inputSchema: {
				projectId: z.string().uuid(),
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
		async ({ projectId, ...itemData }) => {
			const role = await getProjectRole(projectId, userId);
			if (!role || role === 'viewer') {
				throw new Error('Permission denied. You need editor or owner role to add items.');
			}

			const item = await createItem(projectId, {
				...itemData,
				x: null,
				y: null
			});

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(
							{
								id: item.id,
								projectId: item.projectId,
								name: item.name,
								width: item.width,
								height: item.height,
								x: item.x,
								y: item.y,
								rotation: item.rotation,
								color: item.color,
								price: item.price,
								priceCurrency: item.priceCurrency,
								productUrl: item.productUrl,
								shape: item.shape,
								cutoutWidth: item.cutoutWidth,
								cutoutHeight: item.cutoutHeight,
								cutoutCorner: item.cutoutCorner,
								createdAt: item.createdAt?.toISOString()
							},
							null,
							2
						)
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

export const OPTIONS: RequestHandler = async () => {
	return new Response(null, { status: 204, headers: CORS_HEADERS });
};

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
		return withCors(await transport.handleRequest(request));
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
	return withCors(await transport.handleRequest(request));
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

	return withCors(await transport.handleRequest(request));
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

	return withCors(await transport.handleRequest(request));
};
