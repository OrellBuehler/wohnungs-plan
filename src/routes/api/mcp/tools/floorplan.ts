import { z } from 'zod';
import { getBranchItems } from '$lib/server/items';
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
import type { McpServer, ToolHelpers } from '../types';

export function registerFloorplanTools(server: McpServer, helpers: ToolHelpers): void {
	const { getUserId, ensureProjectRole, checkToolEnabled, ensureBranch, asText } = helpers;

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
				getUserId(),
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
}
