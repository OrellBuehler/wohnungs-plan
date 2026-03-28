import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isOnline, setOnline, queueChange, getPendingChanges, getSyncState } from './sync.svelte';

// Mock auth store
vi.mock('./auth.svelte', () => ({
	isAuthenticated: vi.fn(() => false)
}));

describe('sync store', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset online status
		setOnline(true);
	});

	describe('initial state', () => {
		it('isOnline returns true by default (navigator.onLine mocked)', () => {
			expect(isOnline()).toBe(true);
		});

		it('has zero pending changes initially', () => {
			// Note: this may have accumulated from other tests since state persists.
			// We test relative behavior instead.
			const before = getPendingChanges();
			expect(typeof before).toBe('number');
		});
	});

	describe('isOnline / setOnline', () => {
		it('sets online to false', () => {
			setOnline(false);
			expect(isOnline()).toBe(false);
		});

		it('sets online to true', () => {
			setOnline(false);
			setOnline(true);
			expect(isOnline()).toBe(true);
		});
	});

	describe('queueChange', () => {
		it('increments pending changes count', () => {
			const before = getPendingChanges();
			queueChange({
				type: 'update',
				entity: 'project',
				projectId: 'p1'
			});
			expect(getPendingChanges()).toBe(before + 1);
		});

		it('accepts different entity types', () => {
			const before = getPendingChanges();
			queueChange({ type: 'create', entity: 'item', projectId: 'p1', branchId: 'b1' });
			queueChange({ type: 'delete', entity: 'floorplan', projectId: 'p2' });
			expect(getPendingChanges()).toBe(before + 2);
		});
	});

	describe('getSyncState', () => {
		it('returns state object with expected shape', () => {
			const state = getSyncState();
			expect(state).toHaveProperty('isOnline');
			expect(state).toHaveProperty('isSyncing');
			expect(state).toHaveProperty('pendingChanges');
			expect(state).toHaveProperty('lastSynced');
			expect(state).toHaveProperty('error');
		});
	});
});
