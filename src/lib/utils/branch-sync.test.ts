import { describe, expect, it } from 'vitest';
import { shouldApplyUrlBranch } from './branch-sync';

describe('shouldApplyUrlBranch', () => {
	it('returns true when URL branch differs and no pending sync exists', () => {
		expect(shouldApplyUrlBranch('branch-b', 'branch-a', null)).toBe(true);
	});

	it('returns false when URL branch is missing or already active', () => {
		expect(shouldApplyUrlBranch(null, 'branch-a', null)).toBe(false);
		expect(shouldApplyUrlBranch('branch-a', 'branch-a', null)).toBe(false);
	});

	it('prevents rollback while waiting for URL to catch up', () => {
		expect(shouldApplyUrlBranch('branch-old', 'branch-new', 'branch-new')).toBe(false);
	});

	it('prevents rollback even before active branch updates', () => {
		expect(shouldApplyUrlBranch('branch-old', 'branch-old', 'branch-new')).toBe(false);
	});

	it('still allows applying when URL reaches pending branch', () => {
		expect(shouldApplyUrlBranch('branch-new', 'branch-old', 'branch-new')).toBe(true);
	});
});
