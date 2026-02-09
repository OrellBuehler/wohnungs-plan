import { and, asc, eq, inArray } from 'drizzle-orm';
import { getDB, comments, commentReplies, users } from './db';

export interface Reply {
	id: string;
	commentId: string;
	authorId: string;
	authorName: string | null;
	authorAvatarUrl: string | null;
	body: string;
	createdAt: Date | null;
}

export interface CommentWithReplies {
	id: string;
	projectId: string;
	branchId: string;
	authorId: string;
	authorName: string | null;
	authorAvatarUrl: string | null;
	type: string;
	itemId: string | null;
	x: number | null;
	y: number | null;
	resolved: boolean;
	createdAt: Date | null;
	updatedAt: Date | null;
	replies: Reply[];
}

export async function getCommentsByBranch(
	projectId: string,
	branchId: string
): Promise<CommentWithReplies[]> {
	const db = getDB();

	const commentRows = await db
		.select({
			id: comments.id,
			projectId: comments.projectId,
			branchId: comments.branchId,
			authorId: comments.authorId,
			authorName: users.name,
			authorAvatarUrl: users.avatarUrl,
			type: comments.type,
			itemId: comments.itemId,
			x: comments.x,
			y: comments.y,
			resolved: comments.resolved,
			createdAt: comments.createdAt,
			updatedAt: comments.updatedAt
		})
		.from(comments)
		.leftJoin(users, eq(comments.authorId, users.id))
		.where(and(eq(comments.projectId, projectId), eq(comments.branchId, branchId)))
		.orderBy(asc(comments.createdAt));

	if (commentRows.length === 0) return [];

	const commentIds = commentRows.map((c) => c.id);

	const replyRows = await db
		.select({
			id: commentReplies.id,
			commentId: commentReplies.commentId,
			authorId: commentReplies.authorId,
			authorName: users.name,
			authorAvatarUrl: users.avatarUrl,
			body: commentReplies.body,
			createdAt: commentReplies.createdAt
		})
		.from(commentReplies)
		.leftJoin(users, eq(commentReplies.authorId, users.id))
		.where(inArray(commentReplies.commentId, commentIds))
		.orderBy(asc(commentReplies.createdAt));

	const repliesByCommentId = new Map<string, Reply[]>();
	for (const reply of replyRows) {
		const list = repliesByCommentId.get(reply.commentId) ?? [];
		list.push(reply);
		repliesByCommentId.set(reply.commentId, list);
	}

	return commentRows.map((c) => ({
		...c,
		resolved: c.resolved === 1,
		replies: repliesByCommentId.get(c.id) ?? []
	}));
}

export async function getCommentById(commentId: string): Promise<CommentWithReplies | null> {
	const db = getDB();

	const [commentRow] = await db
		.select({
			id: comments.id,
			projectId: comments.projectId,
			branchId: comments.branchId,
			authorId: comments.authorId,
			authorName: users.name,
			authorAvatarUrl: users.avatarUrl,
			type: comments.type,
			itemId: comments.itemId,
			x: comments.x,
			y: comments.y,
			resolved: comments.resolved,
			createdAt: comments.createdAt,
			updatedAt: comments.updatedAt
		})
		.from(comments)
		.leftJoin(users, eq(comments.authorId, users.id))
		.where(eq(comments.id, commentId));

	if (!commentRow) return null;

	const replyRows = await db
		.select({
			id: commentReplies.id,
			commentId: commentReplies.commentId,
			authorId: commentReplies.authorId,
			authorName: users.name,
			authorAvatarUrl: users.avatarUrl,
			body: commentReplies.body,
			createdAt: commentReplies.createdAt
		})
		.from(commentReplies)
		.leftJoin(users, eq(commentReplies.authorId, users.id))
		.where(eq(commentReplies.commentId, commentId))
		.orderBy(asc(commentReplies.createdAt));

	return {
		...commentRow,
		resolved: commentRow.resolved === 1,
		replies: replyRows
	};
}

export async function createComment(data: {
	projectId: string;
	branchId: string;
	authorId: string;
	type: string;
	itemId?: string | null;
	x?: number | null;
	y?: number | null;
	body: string;
}): Promise<CommentWithReplies> {
	const db = getDB();

	const { comment, reply, author } = await db.transaction(async (tx) => {
		const [c] = await tx
			.insert(comments)
			.values({
				projectId: data.projectId,
				branchId: data.branchId,
				authorId: data.authorId,
				type: data.type,
				itemId: data.itemId ?? null,
				x: data.x ?? null,
				y: data.y ?? null
			})
			.returning();

		const [r] = await tx
			.insert(commentReplies)
			.values({
				commentId: c.id,
				authorId: data.authorId,
				body: data.body
			})
			.returning();

		const [a] = await tx
			.select({ name: users.name, avatarUrl: users.avatarUrl })
			.from(users)
			.where(eq(users.id, data.authorId));

		return { comment: c, reply: r, author: a };
	});

	return {
		id: comment.id,
		projectId: comment.projectId,
		branchId: comment.branchId,
		authorId: comment.authorId,
		authorName: author?.name ?? null,
		authorAvatarUrl: author?.avatarUrl ?? null,
		type: comment.type,
		itemId: comment.itemId,
		x: comment.x,
		y: comment.y,
		resolved: comment.resolved === 1,
		createdAt: comment.createdAt,
		updatedAt: comment.updatedAt,
		replies: [
			{
				id: reply.id,
				commentId: reply.commentId,
				authorId: reply.authorId,
				authorName: author?.name ?? null,
				authorAvatarUrl: author?.avatarUrl ?? null,
				body: reply.body,
				createdAt: reply.createdAt
			}
		]
	};
}

export async function addReply(data: {
	commentId: string;
	authorId: string;
	body: string;
}): Promise<Reply> {
	const db = getDB();

	const [reply] = await db
		.insert(commentReplies)
		.values({
			commentId: data.commentId,
			authorId: data.authorId,
			body: data.body
		})
		.returning();

	await db
		.update(comments)
		.set({ updatedAt: new Date() })
		.where(eq(comments.id, data.commentId));

	const [author] = await db
		.select({ name: users.name, avatarUrl: users.avatarUrl })
		.from(users)
		.where(eq(users.id, data.authorId));

	return {
		id: reply.id,
		commentId: reply.commentId,
		authorId: reply.authorId,
		authorName: author?.name ?? null,
		authorAvatarUrl: author?.avatarUrl ?? null,
		body: reply.body,
		createdAt: reply.createdAt
	};
}

export async function resolveComment(commentId: string, resolved: boolean): Promise<void> {
	const db = getDB();
	await db
		.update(comments)
		.set({ resolved: resolved ? 1 : 0, updatedAt: new Date() })
		.where(eq(comments.id, commentId));
}

export async function deleteComment(commentId: string): Promise<void> {
	const db = getDB();
	await db.delete(comments).where(eq(comments.id, commentId));
}
