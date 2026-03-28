import { z } from 'zod';
import { createBranch, getDefaultBranch, listProjectBranches } from '$lib/server/branches';
import type { McpServer, ToolHelpers } from '../types';

export function registerBranchTools(server: McpServer, helpers: ToolHelpers): void {
	const { getUserId, ensureProjectRole, checkToolEnabled, ensureBranch, asText } = helpers;

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

			const branch = await createBranch(project_id, getUserId(), name, forkId);
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
}
