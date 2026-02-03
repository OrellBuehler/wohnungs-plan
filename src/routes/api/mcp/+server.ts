import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { validateAccessToken } from '$lib/server/oauth';
import { getUserProjects } from '$lib/server/projects';
import { createItem } from '$lib/server/items';
import { getProjectRole } from '$lib/server/projects';

/**
 * MCP Server Endpoint
 *
 * Implements Model Context Protocol (MCP) tools over simple JSON-RPC HTTP.
 * Provides AI assistants with tools to interact with the user's projects.
 *
 * Authentication: Bearer token (OAuth access token) in Authorization header
 *
 * Tools:
 * - list_projects: Get user's projects with details
 * - add_furniture_item: Add a furniture item to a project (not yet placed)
 *
 * Protocol: JSON-RPC 2.0 over HTTP POST
 * Request format:
 * {
 *   "jsonrpc": "2.0",
 *   "id": 1,
 *   "method": "tools/call",
 *   "params": {
 *     "name": "list_projects",
 *     "arguments": {}
 *   }
 * }
 */

/**
 * Validate Authorization header and return userId
 */
async function authenticateRequest(request: Request): Promise<string | null> {
	const authHeader = request.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return null;
	}

	const token = authHeader.substring(7);
	const tokenData = await validateAccessToken(token);

	return tokenData?.userId ?? null;
}

/**
 * Handle list_projects tool
 */
async function handleListProjects(userId: string) {
	const projects = await getUserProjects(userId);
	return {
		content: [
			{
				type: 'text',
				text: JSON.stringify(
					projects.map((p) => ({
						id: p.id,
						name: p.name,
						currency: p.currency,
						gridSize: p.gridSize,
						role: p.role,
						createdAt: p.createdAt?.toISOString(),
						updatedAt: p.updatedAt?.toISOString()
					})),
					null,
					2
				)
			}
		]
	};
}

/**
 * Handle add_furniture_item tool
 */
async function handleAddFurnitureItem(userId: string, args: unknown) {
	// Validate input with zod
	const addItemSchema = z.object({
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
		cutoutCorner: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).optional()
	});

	const parsed = addItemSchema.safeParse(args);
	if (!parsed.success) {
		return {
			content: [
				{
					type: 'text',
					text: `Invalid input: ${parsed.error.message}`
				}
			],
			isError: true
		};
	}

	const { projectId, ...itemData } = parsed.data;

	// Check user has editor or owner role
	const role = await getProjectRole(projectId, userId);
	if (!role || role === 'viewer') {
		return {
			content: [
				{
					type: 'text',
					text: 'Permission denied. You need editor or owner role to add items.'
				}
			],
			isError: true
		};
	}

	// Create item with x=null, y=null (not placed)
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

/**
 * GET handler: Return MCP server information and available tools
 */
export const GET: RequestHandler = async ({ request }) => {
	// Authenticate user
	const userId = await authenticateRequest(request);
	if (!userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Return server info and tools list
	return json({
		name: 'wohnungs-plan',
		version: '1.0.0',
		capabilities: {
			tools: {}
		},
		tools: [
			{
				name: 'list_projects',
				description:
					'List all projects the user has access to, including project details (name, currency, grid size, role).',
				inputSchema: {
					type: 'object',
					properties: {},
					required: []
				}
			},
			{
				name: 'add_furniture_item',
				description:
					'Add a new furniture item to a project. The item is added to the inventory (not placed on canvas). Position (x, y) will be null until user places it manually.',
				inputSchema: {
					type: 'object',
					properties: {
						projectId: {
							type: 'string',
							description: 'Project ID where the item should be added'
						},
						name: {
							type: 'string',
							description: 'Name/description of the furniture item (e.g., "Sofa", "Dining Table")'
						},
						width: {
							type: 'number',
							description: 'Width of the item in centimeters'
						},
						height: {
							type: 'number',
							description: 'Height/depth of the item in centimeters'
						},
						color: {
							type: 'string',
							description: 'Hex color code for the item (e.g., "#3b82f6")',
							default: '#3b82f6'
						},
						price: {
							type: 'number',
							description: 'Price of the item (optional)'
						},
						priceCurrency: {
							type: 'string',
							description: 'Currency code (e.g., "EUR", "USD")',
							default: 'EUR'
						},
						productUrl: {
							type: 'string',
							description: 'URL to product page (optional)'
						},
						shape: {
							type: 'string',
							enum: ['rectangle', 'l-shape'],
							description: 'Shape of the item',
							default: 'rectangle'
						},
						cutoutWidth: {
							type: 'number',
							description: 'For L-shaped items: width of the cutout area in centimeters'
						},
						cutoutHeight: {
							type: 'number',
							description: 'For L-shaped items: height of the cutout area in centimeters'
						},
						cutoutCorner: {
							type: 'string',
							enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
							description: 'For L-shaped items: which corner has the cutout'
						}
					},
					required: ['projectId', 'name', 'width', 'height']
				}
			}
		]
	});
};

/**
 * POST handler: Handle JSON-RPC tool calls
 */
export const POST: RequestHandler = async ({ request }) => {
	// Authenticate user
	const userId = await authenticateRequest(request);
	if (!userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Parse JSON-RPC request
	let rpcRequest: any;
	try {
		rpcRequest = await request.json();
	} catch (error) {
		return json(
			{
				jsonrpc: '2.0',
				id: null,
				error: {
					code: -32700,
					message: 'Parse error'
				}
			},
			{ status: 400 }
		);
	}

	// Validate JSON-RPC format
	if (rpcRequest.jsonrpc !== '2.0') {
		return json({
			jsonrpc: '2.0',
			id: rpcRequest.id ?? null,
			error: {
				code: -32600,
				message: 'Invalid Request'
			}
		});
	}

	// Handle different JSON-RPC methods
	try {
		switch (rpcRequest.method) {
			case 'initialize': {
				// MCP initialization
				return json({
					jsonrpc: '2.0',
					id: rpcRequest.id,
					result: {
						protocolVersion: '2024-11-05',
						capabilities: {
							tools: {}
						},
						serverInfo: {
							name: 'wohnungs-plan',
							version: '1.0.0'
						}
					}
				});
			}

			case 'tools/list': {
				// List available tools
				const tools = [
					{
						name: 'list_projects',
						description:
							'List all projects the user has access to, including project details (name, currency, grid size, role).',
						inputSchema: {
							type: 'object',
							properties: {},
							required: []
						}
					},
					{
						name: 'add_furniture_item',
						description:
							'Add a new furniture item to a project. The item is added to the inventory (not placed on canvas). Position (x, y) will be null until user places it manually.',
						inputSchema: {
							type: 'object',
							properties: {
								projectId: {
									type: 'string',
									description: 'Project ID where the item should be added'
								},
								name: {
									type: 'string',
									description: 'Name/description of the furniture item (e.g., "Sofa", "Dining Table")'
								},
								width: {
									type: 'number',
									description: 'Width of the item in centimeters'
								},
								height: {
									type: 'number',
									description: 'Height/depth of the item in centimeters'
								},
								color: {
									type: 'string',
									description: 'Hex color code for the item (e.g., "#3b82f6")',
									default: '#3b82f6'
								},
								price: {
									type: 'number',
									description: 'Price of the item (optional)'
								},
								priceCurrency: {
									type: 'string',
									description: 'Currency code (e.g., "EUR", "USD")',
									default: 'EUR'
								},
								productUrl: {
									type: 'string',
									description: 'URL to product page (optional)'
								},
								shape: {
									type: 'string',
									enum: ['rectangle', 'l-shape'],
									description: 'Shape of the item',
									default: 'rectangle'
								},
								cutoutWidth: {
									type: 'number',
									description: 'For L-shaped items: width of the cutout area in centimeters'
								},
								cutoutHeight: {
									type: 'number',
									description: 'For L-shaped items: height of the cutout area in centimeters'
								},
								cutoutCorner: {
									type: 'string',
									enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
									description: 'For L-shaped items: which corner has the cutout'
								}
							},
							required: ['projectId', 'name', 'width', 'height']
						}
					}
				];

				return json({
					jsonrpc: '2.0',
					id: rpcRequest.id,
					result: {
						tools
					}
				});
			}

			case 'tools/call': {
				// Execute a tool
				const { name, arguments: args } = rpcRequest.params;

				let result;
				switch (name) {
					case 'list_projects':
						result = await handleListProjects(userId);
						break;
					case 'add_furniture_item':
						result = await handleAddFurnitureItem(userId, args);
						break;
					default:
						return json({
							jsonrpc: '2.0',
							id: rpcRequest.id,
							error: {
								code: -32601,
								message: `Unknown tool: ${name}`
							}
						});
				}

				return json({
					jsonrpc: '2.0',
					id: rpcRequest.id,
					result
				});
			}

			default:
				return json({
					jsonrpc: '2.0',
					id: rpcRequest.id,
					error: {
						code: -32601,
						message: 'Method not found'
					}
				});
		}
	} catch (error) {
		return json({
			jsonrpc: '2.0',
			id: rpcRequest.id ?? null,
			error: {
				code: -32603,
				message: `Internal error: ${error instanceof Error ? error.message : String(error)}`
			}
		});
	}
};
