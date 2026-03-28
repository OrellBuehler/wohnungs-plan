import { z } from 'zod';
import { getCommentsByBranch, addReply, getCommentById } from '$lib/server/comments';
import type { McpServer, ToolHelpers } from '../types';

export function registerCommentTools(server: McpServer, helpers: ToolHelpers): void {
	const { getUserId, ensureProjectRole, checkToolEnabled, ensureBranch, asText } = helpers;

	server.registerTool(
		'list_comments',
		{
			description:
				'List all comment threads for a project branch. Each comment has a type (canvas pin or item-attached) and contains threaded replies. The first reply in each thread is the original message. Comments can be resolved or unresolved.',
			inputSchema: {
				project_id: z.string().uuid(),
				branch_id: z.string().uuid()
			}
		},
		async ({ project_id, branch_id }) => {
			await checkToolEnabled('list_comments', project_id);
			await ensureProjectRole(project_id, 'viewer');
			await ensureBranch(project_id, branch_id);

			const threadList = await getCommentsByBranch(project_id, branch_id);
			return asText(
				threadList.map((c) => ({
					id: c.id,
					type: c.type,
					item_id: c.itemId,
					x: c.x,
					y: c.y,
					resolved: c.resolved,
					author_name: c.authorName,
					created_at: c.createdAt?.toISOString(),
					updated_at: c.updatedAt?.toISOString(),
					replies: c.replies.map((r) => ({
						id: r.id,
						author_name: r.authorName,
						body: r.body,
						created_at: r.createdAt?.toISOString()
					}))
				}))
			);
		}
	);

	server.registerTool(
		'add_comment_reply',
		{
			description:
				'Add a reply to an existing comment thread. Use list_comments first to find the comment ID you want to reply to.',
			inputSchema: {
				project_id: z.string().uuid(),
				comment_id: z.string().uuid(),
				body: z.string().min(1)
			}
		},
		async ({ project_id, comment_id, body }) => {
			await checkToolEnabled('add_comment_reply', project_id);
			await ensureProjectRole(project_id, 'editor');

			const comment = await getCommentById(comment_id);
			if (!comment || comment.projectId !== project_id) {
				throw new Error('Comment not found in this project.');
			}

			const reply = await addReply({
				commentId: comment_id,
				authorId: getUserId(),
				body
			});

			return asText({
				id: reply.id,
				comment_id: reply.commentId,
				author_name: reply.authorName,
				body: reply.body,
				created_at: reply.createdAt?.toISOString()
			});
		}
	);
}
