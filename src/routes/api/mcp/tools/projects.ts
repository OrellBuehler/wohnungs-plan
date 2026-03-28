import { getUserProjects } from '$lib/server/projects';
import type { McpServer, ToolHelpers } from '../types';

export function registerProjectTools(server: McpServer, helpers: ToolHelpers): void {
	const { getUserId, asText } = helpers;

	server.registerTool(
		'list_projects',
		{
			description:
				'List all projects the user has access to, including project details (name, currency, grid size, role).',
			inputSchema: {}
		},
		async () => {
			const projects = await getUserProjects(getUserId());
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
}
