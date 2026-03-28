import { z } from 'zod';
import { getBranchItems } from '$lib/server/items';
import { getFloorplanAnalysis } from '$lib/server/floorplan-analyses';
import { getItemsInRoom } from '$lib/server/spatial-queries';
import type { McpServer, ToolHelpers } from './types';

export function registerPrompts(server: McpServer, helpers: ToolHelpers): void {
	const { ensureProjectRole, ensureBranch } = helpers;

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
}
