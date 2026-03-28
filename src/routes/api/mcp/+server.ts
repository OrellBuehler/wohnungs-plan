import type { RequestHandler } from './$types';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { config } from '$lib/server/env';
import { validateAccessToken } from '$lib/server/oauth';
import { getProjectDisabledTools, getProjectRole } from '$lib/server/projects';
import { getBranchById } from '$lib/server/branches';
import { createSessionTransport, getSessionTransport } from './session';
import { registerProjectTools } from './tools/projects';
import { registerBranchTools } from './tools/branches';
import { registerFurnitureTools } from './tools/furniture';
import { registerImageTools } from './tools/images';
import { registerFloorplanTools } from './tools/floorplan';
import { registerCommentTools } from './tools/comments';
import { registerResources } from './resources';
import { registerPrompts } from './prompts';
import type { ToolHelpers } from './types';

const MCP_SERVER_NAME = 'wohnungs-plan';
const MCP_SERVER_VERSION = '3.0.0';
const REQUIRED_SCOPE = 'mcp:access';

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

	const helpers: ToolHelpers = {
		getUserId: () => userId,
		ensureProjectRole,
		checkToolEnabled,
		ensureBranch,
		asText
	};

	registerProjectTools(server, helpers);
	registerBranchTools(server, helpers);
	registerFurnitureTools(server, helpers);
	registerImageTools(server, helpers);
	registerFloorplanTools(server, helpers);
	registerCommentTools(server, helpers);
	registerResources(server, helpers);
	registerPrompts(server, helpers);

	return server;
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

	let body: unknown;
	try {
		body = await request.clone().json();
	} catch {
		return jsonRpcError(400, -32700, 'Parse error: Invalid JSON');
	}

	if (!containsInitializeRequest(body)) {
		return jsonRpcError(400, -32600, 'Invalid Request: Initialization required');
	}

	const transport = await createSessionTransport(auth.userId, createMcpServer);
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
