import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getBranchItems } from '$lib/server/items';
import { getProjectById } from '$lib/server/projects';
import { getDefaultBranch, listProjectBranches } from '$lib/server/branches';
import { getFloorplanAnalysis } from '$lib/server/floorplan-analyses';
import type { McpServer, ToolHelpers } from './types';

export function registerResources(server: McpServer, helpers: ToolHelpers): void {
	const { ensureProjectRole, ensureBranch } = helpers;

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
}
