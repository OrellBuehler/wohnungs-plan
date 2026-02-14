# Comments Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add collaborative threaded commenting (canvas pins + item-attached) with real-time sync and mobile-first UX.

**Architecture:** Two new DB tables (`comments`, `comment_replies`) with REST API endpoints and WebSocket broadcast. A Svelte 5 rune-based store manages client state. Canvas pins rendered via a Konva layer; comment threads displayed in a sidebar (desktop) or bottom sheet (mobile).

**Tech Stack:** SvelteKit, Svelte 5 runes, Drizzle ORM + PostgreSQL, Konva (svelte-konva), shadcn-svelte Sheet/Button/Input, existing WebSocket infra.

**Design doc:** `docs/plans/2026-02-08-comments-design.md`

---

## Task 1: Database Schema

**Files:**
- Modify: `src/lib/server/schema.ts` (add `comments` and `commentReplies` tables at end of file)

**Step 1: Add `comments` table to schema**

Add after the last table definition in `schema.ts`:

```typescript
// Comments (canvas pins and item-attached threads)
export const comments = pgTable(
	'comments',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		projectId: uuid('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		branchId: uuid('branch_id')
			.notNull()
			.references(() => branches.id, { onDelete: 'cascade' }),
		authorId: uuid('author_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		type: text('type').notNull(), // 'canvas' or 'item'
		itemId: uuid('item_id').references(() => items.id, { onDelete: 'cascade' }),
		x: real('x'),
		y: real('y'),
		resolved: integer('resolved').notNull().default(0), // 0=false, 1=true (no boolean in existing pattern)
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
	},
	(table) => [
		index('idx_comments_project_branch').on(table.projectId, table.branchId),
		index('idx_comments_item_id').on(table.itemId),
		check('comments_type_check', sql`${table.type} IN ('canvas', 'item')`)
	]
);

// Comment replies (threaded messages)
export const commentReplies = pgTable(
	'comment_replies',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		commentId: uuid('comment_id')
			.notNull()
			.references(() => comments.id, { onDelete: 'cascade' }),
		authorId: uuid('author_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		body: text('body').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
	},
	(table) => [
		index('idx_comment_replies_comment_id').on(table.commentId)
	]
);
```

**Step 2: Generate and run migration**

Run: `bun db:generate`
Expected: New migration file created in `drizzle/` directory.

Run: `bun db:migrate`
Expected: Migration applies successfully, tables created.

**Step 3: Verify type-check passes**

Run: `bun check`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/lib/server/schema.ts drizzle/
git commit -m "feat(comments): add comments and comment_replies schema"
```

---

## Task 2: Server-Side Data Access Layer

**Files:**
- Create: `src/lib/server/comments.ts`

**Step 1: Create comments data access module**

```typescript
import { eq, and, asc, desc } from 'drizzle-orm';
import { getDB } from './db';
import { comments, commentReplies, users } from './schema';

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

export interface Reply {
	id: string;
	commentId: string;
	authorId: string;
	authorName: string | null;
	authorAvatarUrl: string | null;
	body: string;
	createdAt: Date | null;
}

export async function getCommentsByBranch(
	projectId: string,
	branchId: string
): Promise<CommentWithReplies[]> {
	const db = getDB();

	const rows = await db
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

	const commentIds = rows.map((r) => r.id);
	if (commentIds.length === 0) return [];

	const allReplies = await db
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
		.where(
			// Filter by comments that belong to this branch
			// Using inArray would be ideal but let's keep it simple
			// by filtering in JS since comment counts are typically small
			sql`${commentReplies.commentId} = ANY(${commentIds})`
		)
		.orderBy(asc(commentReplies.createdAt));

	const repliesByComment = new Map<string, Reply[]>();
	for (const r of allReplies) {
		const list = repliesByComment.get(r.commentId) ?? [];
		list.push(r);
		repliesByComment.set(r.commentId, list);
	}

	return rows.map((row) => ({
		...row,
		resolved: row.resolved === 1,
		replies: repliesByComment.get(row.id) ?? []
	}));
}

export async function createComment(data: {
	projectId: string;
	branchId: string;
	authorId: string;
	type: 'canvas' | 'item';
	itemId?: string | null;
	x?: number | null;
	y?: number | null;
	body: string;
}): Promise<CommentWithReplies> {
	const db = getDB();

	const [comment] = await db
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

	const [reply] = await db
		.insert(commentReplies)
		.values({
			commentId: comment.id,
			authorId: data.authorId,
			body: data.body
		})
		.returning();

	// Fetch author info
	const [author] = await db
		.select({ name: users.name, avatarUrl: users.avatarUrl })
		.from(users)
		.where(eq(users.id, data.authorId));

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
		resolved: false,
		createdAt: comment.createdAt,
		updatedAt: comment.updatedAt,
		replies: [
			{
				id: reply.id,
				commentId: comment.id,
				authorId: data.authorId,
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

	// Update comment's updatedAt
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

export async function getCommentById(commentId: string) {
	const db = getDB();
	const [comment] = await db
		.select()
		.from(comments)
		.where(eq(comments.id, commentId));
	return comment ?? null;
}
```

**Note:** The `sql` import for the `ANY` array query — the implementer should check if `inArray` from drizzle-orm works better. Use `import { sql } from 'drizzle-orm'` alongside the other imports.

**Step 2: Verify type-check**

Run: `bun check`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/server/comments.ts
git commit -m "feat(comments): add server-side data access layer"
```

---

## Task 3: REST API Endpoints

**Files:**
- Create: `src/routes/api/projects/[id]/comments/+server.ts` (GET list, POST create)
- Create: `src/routes/api/projects/[id]/comments/[commentId]/+server.ts` (PATCH resolve, DELETE)
- Create: `src/routes/api/projects/[id]/comments/[commentId]/replies/+server.ts` (POST reply)

**Step 1: Create comments collection endpoint**

File: `src/routes/api/projects/[id]/comments/+server.ts`

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole } from '$lib/server/projects';
import { getCommentsByBranch, createComment } from '$lib/server/comments';
import { getDefaultBranch, ensureMainBranch } from '$lib/server/branches';
import { getProjectById } from '$lib/server/projects';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.user) throw error(401, 'Authentication required');

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role) throw error(403, 'Access denied');

	let branch = await getDefaultBranch(params.id);
	if (!branch) {
		const project = await getProjectById(params.id);
		if (!project) throw error(404, 'Project not found');
		branch = await ensureMainBranch(project.id, project.ownerId);
	}

	const branchId = url.searchParams.get('branchId') ?? branch.id;
	const comments = await getCommentsByBranch(params.id, branchId);
	return json({ comments });
};

export const POST: RequestHandler = async ({ locals, params, request, url }) => {
	if (!locals.user) throw error(401, 'Authentication required');

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role || role === 'viewer') throw error(403, 'Edit access required');

	let branch = await getDefaultBranch(params.id);
	if (!branch) {
		const project = await getProjectById(params.id);
		if (!project) throw error(404, 'Project not found');
		branch = await ensureMainBranch(project.id, project.ownerId);
	}

	const body = await request.json();
	const branchId = body.branchId ?? branch.id;

	if (!body.type || !['canvas', 'item'].includes(body.type)) {
		throw error(400, 'Invalid comment type');
	}
	if (!body.body || typeof body.body !== 'string' || body.body.trim().length === 0) {
		throw error(400, 'Comment body is required');
	}

	const comment = await createComment({
		projectId: params.id,
		branchId,
		authorId: locals.user.id,
		type: body.type,
		itemId: body.itemId ?? null,
		x: body.x ?? null,
		y: body.y ?? null,
		body: body.body.trim()
	});

	return json({ comment }, { status: 201 });
};
```

**Step 2: Create single comment endpoint**

File: `src/routes/api/projects/[id]/comments/[commentId]/+server.ts`

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole } from '$lib/server/projects';
import { getCommentById, resolveComment, deleteComment } from '$lib/server/comments';

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) throw error(401, 'Authentication required');

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role || role === 'viewer') throw error(403, 'Edit access required');

	const comment = await getCommentById(params.commentId);
	if (!comment || comment.projectId !== params.id) throw error(404, 'Comment not found');

	const body = await request.json();
	if (typeof body.resolved === 'boolean') {
		await resolveComment(params.commentId, body.resolved);
	}

	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'Authentication required');

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role || role === 'viewer') throw error(403, 'Edit access required');

	const comment = await getCommentById(params.commentId);
	if (!comment || comment.projectId !== params.id) throw error(404, 'Comment not found');

	await deleteComment(params.commentId);
	return json({ success: true });
};
```

**Step 3: Create replies endpoint**

File: `src/routes/api/projects/[id]/comments/[commentId]/replies/+server.ts`

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectRole } from '$lib/server/projects';
import { getCommentById, addReply } from '$lib/server/comments';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) throw error(401, 'Authentication required');

	const role = await getProjectRole(params.id, locals.user.id);
	if (!role || role === 'viewer') throw error(403, 'Edit access required');

	const comment = await getCommentById(params.commentId);
	if (!comment || comment.projectId !== params.id) throw error(404, 'Comment not found');

	const body = await request.json();
	if (!body.body || typeof body.body !== 'string' || body.body.trim().length === 0) {
		throw error(400, 'Reply body is required');
	}

	const reply = await addReply({
		commentId: params.commentId,
		authorId: locals.user.id,
		body: body.body.trim()
	});

	return json({ reply }, { status: 201 });
};
```

**Step 4: Verify type-check**

Run: `bun check`
Expected: No errors.

**Step 5: Commit**

```bash
git add src/routes/api/projects/\[id\]/comments/
git commit -m "feat(comments): add REST API endpoints for comments and replies"
```

---

## Task 4: Client-Side Comments Store

**Files:**
- Create: `src/lib/stores/comments.svelte.ts`

**Step 1: Create comments store with Svelte 5 runes**

```typescript
import type { CommentWithReplies, Reply } from '$lib/server/comments';

// Re-export types for client use (without server imports)
export interface ClientComment {
	id: string;
	projectId: string;
	branchId: string;
	authorId: string;
	authorName: string | null;
	authorAvatarUrl: string | null;
	type: 'canvas' | 'item';
	itemId: string | null;
	x: number | null;
	y: number | null;
	resolved: boolean;
	createdAt: string | null;
	updatedAt: string | null;
	replies: ClientReply[];
}

export interface ClientReply {
	id: string;
	commentId: string;
	authorId: string;
	authorName: string | null;
	authorAvatarUrl: string | null;
	body: string;
	createdAt: string | null;
}

interface CommentsState {
	comments: ClientComment[];
	loading: boolean;
	visible: boolean;
	showResolved: boolean;
	activeCommentId: string | null;
	placementMode: boolean;
}

let state = $state<CommentsState>({
	comments: [],
	loading: false,
	visible: true,
	showResolved: false,
	activeCommentId: null,
	placementMode: false
});

// --- Getters ---

export function getComments(): ClientComment[] {
	return state.comments;
}

export function getCanvasComments(): ClientComment[] {
	return state.comments.filter(
		(c) => c.type === 'canvas' && (state.showResolved || !c.resolved)
	);
}

export function getItemComments(itemId: string): ClientComment[] {
	return state.comments.filter(
		(c) => c.type === 'item' && c.itemId === itemId && (state.showResolved || !c.resolved)
	);
}

export function getItemCommentCount(itemId: string): number {
	return state.comments.filter(
		(c) => c.type === 'item' && c.itemId === itemId && !c.resolved
	).length;
}

export function getActiveComment(): ClientComment | null {
	if (!state.activeCommentId) return null;
	return state.comments.find((c) => c.id === state.activeCommentId) ?? null;
}

export function isCommentsVisible(): boolean {
	return state.visible;
}

export function isPlacementMode(): boolean {
	return state.placementMode;
}

export function isShowResolved(): boolean {
	return state.showResolved;
}

export function isCommentsLoading(): boolean {
	return state.loading;
}

// --- Setters ---

export function setActiveComment(id: string | null): void {
	state.activeCommentId = id;
}

export function toggleCommentsVisibility(): void {
	state.visible = !state.visible;
}

export function toggleShowResolved(): void {
	state.showResolved = !state.showResolved;
}

export function enterPlacementMode(): void {
	state.placementMode = true;
}

export function exitPlacementMode(): void {
	state.placementMode = false;
}

// --- API calls ---

export async function loadComments(projectId: string, branchId: string): Promise<void> {
	state.loading = true;
	try {
		const res = await fetch(`/api/projects/${projectId}/comments?branchId=${branchId}`);
		if (!res.ok) throw new Error('Failed to load comments');
		const data = await res.json();
		state.comments = data.comments;
	} finally {
		state.loading = false;
	}
}

export async function createCanvasComment(
	projectId: string,
	branchId: string,
	x: number,
	y: number,
	body: string
): Promise<ClientComment | null> {
	const res = await fetch(`/api/projects/${projectId}/comments`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ type: 'canvas', branchId, x, y, body })
	});
	if (!res.ok) return null;
	const data = await res.json();
	state.comments = [...state.comments, data.comment];
	state.activeCommentId = data.comment.id;
	state.placementMode = false;
	return data.comment;
}

export async function createItemComment(
	projectId: string,
	branchId: string,
	itemId: string,
	body: string
): Promise<ClientComment | null> {
	const res = await fetch(`/api/projects/${projectId}/comments`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ type: 'item', branchId, itemId, body })
	});
	if (!res.ok) return null;
	const data = await res.json();
	state.comments = [...state.comments, data.comment];
	state.activeCommentId = data.comment.id;
	return data.comment;
}

export async function addReplyToComment(
	projectId: string,
	commentId: string,
	body: string
): Promise<ClientReply | null> {
	const res = await fetch(`/api/projects/${projectId}/comments/${commentId}/replies`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ body })
	});
	if (!res.ok) return null;
	const data = await res.json();
	// Update local state
	state.comments = state.comments.map((c) =>
		c.id === commentId ? { ...c, replies: [...c.replies, data.reply] } : c
	);
	return data.reply;
}

export async function toggleResolve(projectId: string, commentId: string): Promise<void> {
	const comment = state.comments.find((c) => c.id === commentId);
	if (!comment) return;
	const newResolved = !comment.resolved;

	// Optimistic update
	state.comments = state.comments.map((c) =>
		c.id === commentId ? { ...c, resolved: newResolved } : c
	);

	const res = await fetch(`/api/projects/${projectId}/comments/${commentId}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ resolved: newResolved })
	});
	if (!res.ok) {
		// Revert
		state.comments = state.comments.map((c) =>
			c.id === commentId ? { ...c, resolved: !newResolved } : c
		);
	}
}

export async function removeComment(projectId: string, commentId: string): Promise<void> {
	const prev = state.comments;
	state.comments = state.comments.filter((c) => c.id !== commentId);
	if (state.activeCommentId === commentId) state.activeCommentId = null;

	const res = await fetch(`/api/projects/${projectId}/comments/${commentId}`, {
		method: 'DELETE'
	});
	if (!res.ok) {
		state.comments = prev;
	}
}

// --- WebSocket handlers (called from collaboration store) ---

export function handleRemoteCommentCreated(comment: ClientComment): void {
	if (!state.comments.find((c) => c.id === comment.id)) {
		state.comments = [...state.comments, comment];
	}
}

export function handleRemoteReplyCreated(commentId: string, reply: ClientReply): void {
	state.comments = state.comments.map((c) =>
		c.id === commentId && !c.replies.find((r) => r.id === reply.id)
			? { ...c, replies: [...c.replies, reply] }
			: c
	);
}

export function handleRemoteCommentResolved(commentId: string, resolved: boolean): void {
	state.comments = state.comments.map((c) =>
		c.id === commentId ? { ...c, resolved } : c
	);
}

export function handleRemoteCommentDeleted(commentId: string): void {
	state.comments = state.comments.filter((c) => c.id !== commentId);
	if (state.activeCommentId === commentId) state.activeCommentId = null;
}

export function resetComments(): void {
	state.comments = [];
	state.loading = false;
	state.activeCommentId = null;
	state.placementMode = false;
}
```

**Step 2: Verify type-check**

Run: `bun check`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/stores/comments.svelte.ts
git commit -m "feat(comments): add client-side comments store"
```

---

## Task 5: WebSocket Integration

**Files:**
- Modify: `src/lib/server/ws-handler.ts` (add comment message types)
- Modify: `src/lib/stores/collaboration.svelte.ts` (add comment send/receive handlers)

**Step 1: Extend WSMessage type in ws-handler.ts**

Add to the `WSMessage` union type (around line 23-30):

```typescript
| { type: 'comment_created'; comment: unknown }
| { type: 'reply_created'; commentId: string; reply: unknown }
| { type: 'comment_resolved'; commentId: string; resolved: boolean }
| { type: 'comment_deleted'; commentId: string }
```

**Step 2: Add cases in handleWSMessage switch**

Add before the closing `}` of the switch block (after the `item_deleted` case):

```typescript
case 'comment_created':
case 'reply_created':
case 'comment_resolved':
case 'comment_deleted':
	broadcastToProject(roomId, { ...msg, branchId }, connectionId);
	break;
```

**Step 3: Add send functions in collaboration.svelte.ts**

Add alongside existing `sendItemUpdated`, `sendItemCreated`, etc.:

```typescript
export function sendCommentCreated(comment: unknown): void {
	send({ type: 'comment_created', comment });
}

export function sendReplyCreated(commentId: string, reply: unknown): void {
	send({ type: 'reply_created', commentId, reply });
}

export function sendCommentResolved(commentId: string, resolved: boolean): void {
	send({ type: 'comment_resolved', commentId, resolved });
}

export function sendCommentDeleted(commentId: string): void {
	send({ type: 'comment_deleted', commentId });
}
```

**Step 4: Add receive handling in collaboration.svelte.ts handleMessage**

Add cases in the message handler switch:

```typescript
case 'comment_created':
	handleRemoteCommentCreated(parsed.comment);
	break;
case 'reply_created':
	handleRemoteReplyCreated(parsed.commentId, parsed.reply);
	break;
case 'comment_resolved':
	handleRemoteCommentResolved(parsed.commentId, parsed.resolved);
	break;
case 'comment_deleted':
	handleRemoteCommentDeleted(parsed.commentId);
	break;
```

Import the handlers at the top of collaboration.svelte.ts:

```typescript
import {
	handleRemoteCommentCreated,
	handleRemoteReplyCreated,
	handleRemoteCommentResolved,
	handleRemoteCommentDeleted
} from './comments.svelte';
```

**Step 5: Update comments store API calls to also broadcast**

In `comments.svelte.ts`, after each successful API call, also call the corresponding send function. Import from collaboration store:

```typescript
import {
	sendCommentCreated,
	sendReplyCreated,
	sendCommentResolved,
	sendCommentDeleted
} from './collaboration.svelte';
```

Then in `createCanvasComment` and `createItemComment` after `state.comments = [...]`:
```typescript
sendCommentCreated(data.comment);
```

In `addReplyToComment` after updating state:
```typescript
sendReplyCreated(commentId, data.reply);
```

In `toggleResolve` after optimistic update:
```typescript
sendCommentResolved(commentId, newResolved);
```

In `removeComment` after optimistic update:
```typescript
sendCommentDeleted(commentId);
```

**Step 6: Verify type-check**

Run: `bun check`
Expected: No errors.

**Step 7: Commit**

```bash
git add src/lib/server/ws-handler.ts src/lib/stores/collaboration.svelte.ts src/lib/stores/comments.svelte.ts
git commit -m "feat(comments): add real-time WebSocket sync for comments"
```

---

## Task 6: Comment Thread UI Component

**Files:**
- Create: `src/lib/components/comments/CommentThread.svelte`

**Step 1: Build the thread component**

This component displays a single comment's thread (all replies + reply input). Used in both sidebar and bottom sheet.

```svelte
<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		addReplyToComment,
		toggleResolve,
		type ClientComment
	} from '$lib/stores/comments.svelte';

	interface Props {
		comment: ClientComment;
		projectId: string;
		canEdit: boolean;
	}

	let { comment, projectId, canEdit }: Props = $props();

	let replyText = $state('');
	let submitting = $state(false);

	function getInitial(name: string | null): string {
		return name?.charAt(0)?.toUpperCase() ?? '?';
	}

	function formatTime(dateStr: string | null): string {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		const diffHrs = Math.floor(diffMins / 60);
		if (diffHrs < 24) return `${diffHrs}h ago`;
		const diffDays = Math.floor(diffHrs / 24);
		return `${diffDays}d ago`;
	}

	async function handleSubmitReply() {
		if (!replyText.trim() || submitting) return;
		submitting = true;
		await addReplyToComment(projectId, comment.id, replyText.trim());
		replyText = '';
		submitting = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmitReply();
		}
	}
</script>

<div class="flex flex-col gap-3">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<span class="text-xs text-slate-400 uppercase tracking-wide">
			{comment.type === 'canvas' ? 'Pin comment' : 'Item comment'}
		</span>
		{#if canEdit}
			<Button
				variant="ghost"
				size="sm"
				class="h-6 text-xs {comment.resolved ? 'text-green-600' : 'text-slate-500'}"
				onclick={() => toggleResolve(projectId, comment.id)}
			>
				{comment.resolved ? 'Resolved' : 'Resolve'}
			</Button>
		{/if}
	</div>

	<!-- Replies -->
	<div class="flex flex-col gap-2 max-h-[40vh] overflow-y-auto">
		{#each comment.replies as reply (reply.id)}
			<div class="flex gap-2">
				<div
					class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-medium flex-shrink-0"
				>
					{getInitial(reply.authorName)}
				</div>
				<div class="flex-1 min-w-0">
					<div class="flex items-baseline gap-2">
						<span class="text-sm font-medium text-slate-700 truncate">
							{reply.authorName ?? 'Unknown'}
						</span>
						<span class="text-xs text-slate-400">{formatTime(reply.createdAt)}</span>
					</div>
					<p class="text-sm text-slate-600 whitespace-pre-wrap break-words">{reply.body}</p>
				</div>
			</div>
		{/each}
	</div>

	<!-- Reply input -->
	{#if canEdit}
		<div class="flex gap-2">
			<Input
				bind:value={replyText}
				placeholder="Reply..."
				class="flex-1 h-8 text-sm"
				onkeydown={handleKeydown}
			/>
			<Button
				size="sm"
				class="h-8"
				disabled={!replyText.trim() || submitting}
				onclick={handleSubmitReply}
			>
				Send
			</Button>
		</div>
	{/if}
</div>
```

**Step 2: Verify type-check**

Run: `bun check`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/components/comments/CommentThread.svelte
git commit -m "feat(comments): add CommentThread UI component"
```

---

## Task 7: Comment Panel (Sidebar + Bottom Sheet)

**Files:**
- Create: `src/lib/components/comments/CommentPanel.svelte`

**Step 1: Build the panel component**

Desktop: renders as a positioned sidebar panel. Mobile: renders inside a Sheet (bottom sheet).

```svelte
<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet';
	import { Button } from '$lib/components/ui/button';
	import CommentThread from './CommentThread.svelte';
	import {
		getActiveComment,
		setActiveComment,
		getCanvasComments,
		isShowResolved,
		toggleShowResolved
	} from '$lib/stores/comments.svelte';

	interface Props {
		projectId: string;
		canEdit: boolean;
		isMobile: boolean;
	}

	let { projectId, canEdit, isMobile }: Props = $props();

	const activeComment = $derived(getActiveComment());
	const open = $derived(activeComment !== null);

	function handleClose() {
		setActiveComment(null);
	}
</script>

{#if isMobile}
	<!-- Mobile: Bottom Sheet -->
	<Sheet.Root {open} onOpenChange={(v) => { if (!v) handleClose(); }}>
		<Sheet.Content side="bottom" class="max-h-[70vh] rounded-t-xl px-4 pb-4" style="padding-bottom: env(safe-area-inset-bottom);">
			<Sheet.Header class="pb-2">
				<Sheet.Title class="text-sm">Comment</Sheet.Title>
			</Sheet.Header>
			{#if activeComment}
				<CommentThread comment={activeComment} {projectId} {canEdit} />
			{/if}
		</Sheet.Content>
	</Sheet.Root>
{:else}
	<!-- Desktop: Side panel -->
	{#if activeComment}
		<div class="w-72 border-l border-slate-200 bg-white p-4 flex flex-col gap-3 overflow-y-auto">
			<div class="flex items-center justify-between">
				<span class="text-sm font-medium text-slate-700">Comment</span>
				<Button variant="ghost" size="sm" class="h-6 w-6 p-0" onclick={handleClose}>
					✕
				</Button>
			</div>
			<CommentThread comment={activeComment} {projectId} {canEdit} />
		</div>
	{/if}
{/if}
```

**Step 2: Verify type-check**

Run: `bun check`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/components/comments/CommentPanel.svelte
git commit -m "feat(comments): add CommentPanel with sidebar and bottom sheet"
```

---

## Task 8: Canvas Comments Layer (Konva)

**Files:**
- Create: `src/lib/components/canvas/CommentsLayer.svelte`

**Step 1: Build the Konva layer for comment pins**

```svelte
<script lang="ts">
	import { Group, Circle, Text } from 'svelte-konva';
	import {
		getCanvasComments,
		isCommentsVisible,
		setActiveComment,
		isPlacementMode,
		type ClientComment
	} from '$lib/stores/comments.svelte';

	interface Props {
		isMobile: boolean;
	}

	let { isMobile }: Props = $props();

	const comments = $derived(getCanvasComments());
	const visible = $derived(isCommentsVisible());
	const pinSize = $derived(isMobile ? 16 : 12);

	function handlePinClick(comment: ClientComment) {
		if (isPlacementMode()) return;
		setActiveComment(comment.id);
	}

	function getInitial(name: string | null): string {
		return name?.charAt(0)?.toUpperCase() ?? '?';
	}
</script>

{#if visible}
	{#each comments as comment, i (comment.id)}
		{#if comment.x != null && comment.y != null}
			<Group
				config={{
					x: comment.x,
					y: comment.y,
					listening: true
				}}
				on:click={() => handlePinClick(comment)}
				on:tap={() => handlePinClick(comment)}
			>
				<!-- Pin circle -->
				<Circle
					config={{
						x: 0,
						y: 0,
						radius: pinSize,
						fill: comment.resolved ? '#94a3b8' : '#6366f1',
						stroke: '#fff',
						strokeWidth: 2,
						opacity: comment.resolved ? 0.5 : 0.9
					}}
				/>
				<!-- Author initial -->
				<Text
					config={{
						x: -pinSize / 2,
						y: -pinSize / 2,
						width: pinSize,
						height: pinSize,
						text: getInitial(comment.authorName),
						fontSize: pinSize * 0.8,
						fill: '#fff',
						fontStyle: 'bold',
						align: 'center',
						verticalAlign: 'middle',
						listening: false
					}}
				/>
			</Group>
		{/if}
	{/each}
{/if}
```

**Step 2: Verify type-check**

Run: `bun check`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/components/canvas/CommentsLayer.svelte
git commit -m "feat(comments): add Konva CommentsLayer for canvas pins"
```

---

## Task 9: Canvas Placement Mode

**Files:**
- Create: `src/lib/components/comments/PlacementOverlay.svelte`

**Step 1: Build the placement mode overlay**

This overlay appears when the user wants to add a canvas comment. On mobile, it shows a crosshair at screen center with Place/Cancel buttons. On desktop, it just changes the cursor and waits for a click.

```svelte
<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { isPlacementMode, exitPlacementMode } from '$lib/stores/comments.svelte';

	interface Props {
		isMobile: boolean;
		onPlace: (screenX: number, screenY: number) => void;
	}

	let { isMobile, onPlace }: Props = $props();

	const active = $derived(isPlacementMode());

	function handlePlaceMobile() {
		// Place at center of viewport
		const x = window.innerWidth / 2;
		const y = window.innerHeight / 2;
		onPlace(x, y);
	}
</script>

{#if active}
	{#if isMobile}
		<!-- Mobile: Crosshair + buttons -->
		<div class="fixed inset-0 z-50 pointer-events-none">
			<!-- Crosshair at center -->
			<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
				<div class="w-8 h-8 border-2 border-indigo-500 rounded-full"></div>
				<div class="absolute top-1/2 left-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 bg-indigo-500 rounded-full"></div>
			</div>

			<!-- Buttons at bottom -->
			<div
				class="absolute bottom-0 left-0 right-0 flex gap-3 justify-center p-4 bg-white/90 backdrop-blur-sm pointer-events-auto"
				style="padding-bottom: calc(env(safe-area-inset-bottom) + 1rem);"
			>
				<Button variant="outline" onclick={exitPlacementMode}>Cancel</Button>
				<Button onclick={handlePlaceMobile}>Place Comment</Button>
			</div>
		</div>
	{:else}
		<!-- Desktop: Banner -->
		<div class="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-3 text-sm">
			Click on the floorplan to place a comment
			<Button variant="secondary" size="sm" onclick={exitPlacementMode}>Cancel</Button>
		</div>
	{/if}
{/if}
```

**Step 2: Verify type-check**

Run: `bun check`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/components/comments/PlacementOverlay.svelte
git commit -m "feat(comments): add PlacementOverlay for comment placement mode"
```

---

## Task 10: Integrate Into Project Page

**Files:**
- Modify: `src/routes/projects/[id]/+page.svelte`
- Modify: `src/lib/components/canvas/CanvasControls.svelte`
- Modify: `src/lib/components/canvas/FloorplanCanvas.svelte`

This is the integration task — wiring everything together. It requires careful reading of the existing page code.

**Step 1: Add comments visibility toggle to CanvasControls**

In `CanvasControls.svelte`, add imports:

```typescript
import {
	isCommentsVisible,
	toggleCommentsVisibility,
	getComments
} from '$lib/stores/comments.svelte';
```

Add derived state:

```typescript
const showComments = $derived(isCommentsVisible());
const commentCount = $derived(getComments().filter(c => !c.resolved).length);
```

Add a toggle checkbox after the walls/doors toggle (after the `{/if}` for `hasAnalysis`):

```svelte
<Label class="flex items-center gap-2 text-slate-600 cursor-pointer">
	<Checkbox
		checked={showComments}
		onchange={() => toggleCommentsVisibility()}
	/>
	Comments
</Label>
```

Optionally show count when visible:

```svelte
{#if showComments && commentCount > 0}
	<span class="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
		{commentCount} comment{commentCount !== 1 ? 's' : ''}
	</span>
{/if}
```

**Step 2: Add CommentsLayer to FloorplanCanvas**

In `FloorplanCanvas.svelte`:
- Import `CommentsLayer` from `$lib/components/canvas/CommentsLayer.svelte`
- Add `<CommentsLayer {isMobile} />` inside the Stage, after the WallsDoorsLayer (in the first non-listening Layer)
- Add click handler for placement mode: when `isPlacementMode()` is true and user clicks on canvas, convert screen coordinates to canvas coordinates and call `createCanvasComment`

**Step 3: Load comments on project page mount**

In `+page.svelte`:
- Import `loadComments`, `resetComments`, `enterPlacementMode` from comments store
- Import `CommentPanel`, `PlacementOverlay` components
- Call `loadComments(project.id, branch.id)` after project loads
- Call `resetComments()` on unmount
- Add `<CommentPanel {projectId} canEdit={role !== 'viewer'} {isMobile} />` alongside the existing sidebar
- Add `<PlacementOverlay {isMobile} onPlace={handlePlaceComment} />`
- Add an "Add Comment" button (visible for editors/owners)
- Wire `handlePlaceComment` to convert screen→canvas coords and call `createCanvasComment`

**Step 4: Add item comments section**

In the item detail panel (sidebar or ItemBottomSheet):
- Import `getItemComments`, `getItemCommentCount`, `createItemComment` from comments store
- Show comment count badge
- Add a "Comments" section with threads for the selected item
- Add reply input for editors/owners

**Step 5: Verify type-check**

Run: `bun check`
Expected: No errors.

**Step 6: Manual test**

- Open a project in the browser
- Click "Add Comment" → enter placement mode → click canvas → type message → submit
- Verify pin appears on canvas
- Click pin → thread opens in sidebar/bottom sheet
- Reply to a thread
- Resolve a thread → pin becomes dimmed
- Toggle comments visibility → pins disappear/reappear
- Open on mobile → verify bottom sheet, crosshair placement mode
- Open in two browser tabs → verify real-time sync

**Step 7: Commit**

```bash
git add src/routes/projects/\[id\]/+page.svelte src/lib/components/canvas/CanvasControls.svelte src/lib/components/canvas/FloorplanCanvas.svelte
git commit -m "feat(comments): integrate comments into project page and canvas"
```

---

## Task 11: Item Comment Badges

**Files:**
- Modify: `src/lib/components/canvas/FloorplanCanvas.svelte` (add badge rendering on items)

**Step 1: Add comment count badges to furniture items on canvas**

In the item rendering section of FloorplanCanvas, for each item Group:
- Import `getItemCommentCount`, `isCommentsVisible` from comments store
- When comments are visible and an item has comments, render a small circle with count in the top-right corner of the item shape

```svelte
{#if isCommentsVisible() && getItemCommentCount(item.id) > 0}
	<Circle
		config={{
			x: item.width / 2,
			y: -item.height / 2,
			radius: 8,
			fill: '#6366f1',
			stroke: '#fff',
			strokeWidth: 1
		}}
	/>
	<Text
		config={{
			x: item.width / 2 - 4,
			y: -item.height / 2 - 5,
			text: String(getItemCommentCount(item.id)),
			fontSize: 10,
			fill: '#fff',
			fontStyle: 'bold',
			align: 'center',
			width: 8
		}}
	/>
{/if}
```

**Step 2: Verify type-check and test visually**

Run: `bun check`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/components/canvas/FloorplanCanvas.svelte
git commit -m "feat(comments): add comment count badges to items on canvas"
```

---

## Task 12: Unread Badge Indicator

**Files:**
- Modify: `src/lib/stores/comments.svelte.ts` (add unread tracking)
- Modify where the "Add Comment" button lives to show unread count

**Step 1: Add unread tracking to comments store**

Add to `CommentsState`:
```typescript
lastSeenAt: string | null; // ISO timestamp, persisted to localStorage
```

Add functions:

```typescript
export function getUnreadCount(): number {
	if (!state.lastSeenAt) return state.comments.length;
	return state.comments.filter(
		(c) => c.updatedAt && c.updatedAt > state.lastSeenAt!
	).length;
}

export function markAllRead(): void {
	state.lastSeenAt = new Date().toISOString();
	try {
		localStorage.setItem(`comments-seen-${currentProjectId}`, state.lastSeenAt);
	} catch {}
}

// Call on loadComments to restore lastSeenAt from localStorage
```

In `loadComments`, after fetching, restore from localStorage:
```typescript
try {
	state.lastSeenAt = localStorage.getItem(`comments-seen-${projectId}`) ?? null;
} catch {}
```

**Step 2: Show unread badge in UI**

Add a badge dot/count next to the "Comments" toggle or "Add Comment" button.

**Step 3: Verify type-check**

Run: `bun check`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/lib/stores/comments.svelte.ts src/routes/projects/\[id\]/+page.svelte
git commit -m "feat(comments): add unread comment badge with localStorage tracking"
```

---

## Task 13: Final Testing & Cleanup

**Step 1: Run full type-check**

Run: `bun check`
Expected: No errors.

**Step 2: Run existing tests**

Run: `bun test`
Expected: All 66+ tests pass, no regressions.

**Step 3: Manual end-to-end test checklist**

- [ ] Create canvas pin comment (desktop click)
- [ ] Create canvas pin comment (mobile crosshair placement)
- [ ] Create item comment from detail panel
- [ ] Reply to a thread
- [ ] Resolve/unresolve a thread
- [ ] Toggle comments visibility
- [ ] Toggle "show resolved"
- [ ] Verify real-time sync (two tabs)
- [ ] Verify viewer cannot create/reply
- [ ] Verify pins are correct size on mobile (32px) vs desktop (24px)
- [ ] Verify bottom sheet keyboard handling on iOS/Android
- [ ] Verify unread badge appears for new comments

**Step 4: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "feat(comments): final cleanup and polish"
```
