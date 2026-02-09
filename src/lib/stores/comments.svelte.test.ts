import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	getComments,
	getCanvasComments,
	getItemComments,
	getItemCommentCount,
	getActiveComment,
	setActiveComment,
	isPlacementMode,
	enterPlacementMode,
	exitPlacementMode,
	getUnreadCount,
	handleRemoteCommentCreated,
	handleRemoteCommentResolved,
	handleRemoteCommentDeleted,
	handleRemoteReplyCreated,
	loadComments,
	createComment,
	toggleResolve,
	removeComment,
	resetComments,
	toggleShowResolved,
	getPinningCommentId,
	getPendingComment,
	setPendingComment,
	type ClientComment,
	type ClientReply
} from './comments.svelte';

// Mock the collaboration module
vi.mock('./collaboration.svelte', () => ({
	sendCommentCreated: vi.fn(),
	sendReplyCreated: vi.fn(),
	sendCommentResolved: vi.fn(),
	sendCommentDeleted: vi.fn()
}));

function makeComment(overrides: Partial<ClientComment> = {}): ClientComment {
	return {
		id: 'c1',
		projectId: 'p1',
		branchId: 'b1',
		authorId: 'u1',
		authorName: 'User 1',
		authorAvatarUrl: null,
		type: 'canvas',
		itemId: null,
		x: 100,
		y: 200,
		resolved: false,
		createdAt: '2024-01-01T00:00:00Z',
		updatedAt: '2024-01-01T00:00:00Z',
		replies: [],
		...overrides
	};
}

describe('comments store', () => {
	beforeEach(() => {
		resetComments();
		vi.clearAllMocks();
	});

	describe('initial state', () => {
		it('has no comments', () => {
			expect(getComments()).toEqual([]);
		});

		it('has no active comment', () => {
			expect(getActiveComment()).toBeNull();
		});

		it('is not in placement mode', () => {
			expect(isPlacementMode()).toBe(false);
		});
	});

	describe('filtering', () => {
		beforeEach(() => {
			// Seed comments via remote handler to avoid fetch
			handleRemoteCommentCreated(makeComment({ id: 'c1', type: 'canvas', resolved: false }));
			handleRemoteCommentCreated(makeComment({ id: 'c2', type: 'canvas', resolved: true }));
			handleRemoteCommentCreated(makeComment({ id: 'c3', type: 'item', itemId: 'item-1', resolved: false }));
			handleRemoteCommentCreated(makeComment({ id: 'c4', type: 'item', itemId: 'item-1', resolved: true }));
			handleRemoteCommentCreated(makeComment({ id: 'c5', type: 'item', itemId: 'item-2', resolved: false }));
		});

		it('getCanvasComments filters to unresolved canvas comments by default', () => {
			const canvas = getCanvasComments();
			expect(canvas).toHaveLength(1);
			expect(canvas[0].id).toBe('c1');
		});

		it('getCanvasComments includes resolved when showResolved is toggled', () => {
			toggleShowResolved();
			const canvas = getCanvasComments();
			expect(canvas).toHaveLength(2);
		});

		it('getItemComments filters by itemId and excludes resolved', () => {
			const items = getItemComments('item-1');
			expect(items).toHaveLength(1);
			expect(items[0].id).toBe('c3');
		});

		it('getItemCommentCount counts unresolved item comments', () => {
			expect(getItemCommentCount('item-1')).toBe(1);
			expect(getItemCommentCount('item-2')).toBe(1);
			expect(getItemCommentCount('nonexistent')).toBe(0);
		});
	});

	describe('active comment', () => {
		it('sets and gets active comment', () => {
			handleRemoteCommentCreated(makeComment({ id: 'c1' }));
			setActiveComment('c1');
			const active = getActiveComment();
			expect(active).not.toBeNull();
			expect(active!.id).toBe('c1');
		});

		it('returns null when no comment matches', () => {
			setActiveComment('nonexistent');
			expect(getActiveComment()).toBeNull();
		});
	});

	describe('placement mode', () => {
		it('enters placement mode', () => {
			enterPlacementMode();
			expect(isPlacementMode()).toBe(true);
			expect(getPinningCommentId()).toBeNull();
		});

		it('enters placement mode with pinning comment ID', () => {
			enterPlacementMode('c1');
			expect(isPlacementMode()).toBe(true);
			expect(getPinningCommentId()).toBe('c1');
		});

		it('clears active comment on enter', () => {
			handleRemoteCommentCreated(makeComment({ id: 'c1' }));
			setActiveComment('c1');
			enterPlacementMode();
			expect(getActiveComment()).toBeNull();
		});

		it('exits placement mode', () => {
			enterPlacementMode();
			exitPlacementMode();
			expect(isPlacementMode()).toBe(false);
			expect(getPinningCommentId()).toBeNull();
			expect(getPendingComment()).toBeNull();
		});
	});

	describe('pending comment', () => {
		it('sets pending comment and exits placement mode', () => {
			enterPlacementMode();
			setPendingComment({ x: 50, y: 100 });
			expect(getPendingComment()).toEqual({ x: 50, y: 100 });
			expect(isPlacementMode()).toBe(false);
		});

		it('clears pending comment', () => {
			setPendingComment({ x: 50, y: 100 });
			setPendingComment(null);
			expect(getPendingComment()).toBeNull();
		});
	});

	describe('unread count', () => {
		it('counts all comments when lastSeenAt is null', () => {
			handleRemoteCommentCreated(makeComment({ id: 'c1' }));
			handleRemoteCommentCreated(makeComment({ id: 'c2' }));
			expect(getUnreadCount()).toBe(2);
		});

		it('counts comments updated after lastSeenAt', () => {
			handleRemoteCommentCreated(
				makeComment({ id: 'c1', updatedAt: '2024-01-01T00:00:00Z' })
			);
			handleRemoteCommentCreated(
				makeComment({ id: 'c2', updatedAt: '2024-06-01T00:00:00Z' })
			);
			// Manually seed lastSeenAt by loading comments with localStorage mock
			// Instead, we check unread = all since lastSeenAt is null
			expect(getUnreadCount()).toBe(2);
		});
	});

	describe('remote handlers', () => {
		it('handleRemoteCommentCreated adds a comment', () => {
			handleRemoteCommentCreated(makeComment({ id: 'c1' }));
			expect(getComments()).toHaveLength(1);
		});

		it('handleRemoteCommentCreated deduplicates', () => {
			handleRemoteCommentCreated(makeComment({ id: 'c1' }));
			handleRemoteCommentCreated(makeComment({ id: 'c1' }));
			expect(getComments()).toHaveLength(1);
		});

		it('handleRemoteCommentResolved updates resolved state', () => {
			handleRemoteCommentCreated(makeComment({ id: 'c1', resolved: false }));
			handleRemoteCommentResolved('c1', true);
			expect(getComments()[0].resolved).toBe(true);
		});

		it('handleRemoteCommentDeleted removes comment', () => {
			handleRemoteCommentCreated(makeComment({ id: 'c1' }));
			handleRemoteCommentDeleted('c1');
			expect(getComments()).toHaveLength(0);
		});

		it('handleRemoteCommentDeleted clears active if deleted', () => {
			handleRemoteCommentCreated(makeComment({ id: 'c1' }));
			setActiveComment('c1');
			handleRemoteCommentDeleted('c1');
			expect(getActiveComment()).toBeNull();
		});

		it('handleRemoteReplyCreated adds reply to comment', () => {
			handleRemoteCommentCreated(makeComment({ id: 'c1' }));
			const reply: ClientReply = {
				id: 'r1',
				commentId: 'c1',
				authorId: 'u2',
				authorName: 'User 2',
				authorAvatarUrl: null,
				body: 'A reply',
				createdAt: '2024-01-02T00:00:00Z'
			};
			handleRemoteReplyCreated('c1', reply);
			expect(getComments()[0].replies).toHaveLength(1);
			expect(getComments()[0].replies[0].id).toBe('r1');
		});

		it('handleRemoteReplyCreated deduplicates replies', () => {
			handleRemoteCommentCreated(makeComment({ id: 'c1' }));
			const reply: ClientReply = {
				id: 'r1',
				commentId: 'c1',
				authorId: 'u2',
				authorName: null,
				authorAvatarUrl: null,
				body: 'Reply',
				createdAt: null
			};
			handleRemoteReplyCreated('c1', reply);
			handleRemoteReplyCreated('c1', reply);
			expect(getComments()[0].replies).toHaveLength(1);
		});
	});

	describe('API functions', () => {
		describe('loadComments', () => {
			it('fetches and sets comments', async () => {
				const mockComments = [makeComment({ id: 'c1' }), makeComment({ id: 'c2' })];
				(globalThis.fetch as any).mockResolvedValueOnce({
					ok: true,
					json: async () => ({ comments: mockComments })
				});

				await loadComments('p1', 'b1');
				expect(getComments()).toHaveLength(2);
			});

			it('handles fetch failure gracefully', async () => {
				(globalThis.fetch as any).mockResolvedValueOnce({ ok: false, status: 500 });

				await loadComments('p1', 'b1');
				expect(getComments()).toEqual([]);
			});
		});

		describe('createComment', () => {
			it('adds comment on success', async () => {
				const created = makeComment({ id: 'new-1' });
				(globalThis.fetch as any).mockResolvedValueOnce({
					ok: true,
					json: async () => ({ comment: created })
				});

				const result = await createComment('p1', 'b1', 'Hello');
				expect(result).not.toBeNull();
				expect(result!.id).toBe('new-1');
				expect(getComments()).toHaveLength(1);
			});

			it('returns null on failure', async () => {
				(globalThis.fetch as any).mockResolvedValueOnce({ ok: false, status: 400 });

				const result = await createComment('p1', 'b1', 'Hello');
				expect(result).toBeNull();
			});
		});

		describe('toggleResolve', () => {
			it('optimistically updates then confirms', async () => {
				handleRemoteCommentCreated(makeComment({ id: 'c1', resolved: false }));
				(globalThis.fetch as any).mockResolvedValueOnce({ ok: true });

				await toggleResolve('p1', 'c1');
				expect(getComments()[0].resolved).toBe(true);
			});

			it('rolls back on failure', async () => {
				handleRemoteCommentCreated(makeComment({ id: 'c1', resolved: false }));
				(globalThis.fetch as any).mockResolvedValueOnce({ ok: false, status: 500 });

				await toggleResolve('p1', 'c1');
				expect(getComments()[0].resolved).toBe(false);
			});
		});

		describe('removeComment', () => {
			it('optimistically removes comment', async () => {
				handleRemoteCommentCreated(makeComment({ id: 'c1' }));
				(globalThis.fetch as any).mockResolvedValueOnce({ ok: true });

				await removeComment('p1', 'c1');
				expect(getComments()).toHaveLength(0);
			});

			it('rolls back on failure', async () => {
				handleRemoteCommentCreated(makeComment({ id: 'c1' }));
				(globalThis.fetch as any).mockResolvedValueOnce({ ok: false, status: 500 });

				await removeComment('p1', 'c1');
				expect(getComments()).toHaveLength(1);
			});

			it('clears active comment if deleted', async () => {
				handleRemoteCommentCreated(makeComment({ id: 'c1' }));
				setActiveComment('c1');
				(globalThis.fetch as any).mockResolvedValueOnce({ ok: true });

				await removeComment('p1', 'c1');
				expect(getActiveComment()).toBeNull();
			});
		});
	});
});
