import { describe, it, expect, beforeEach } from 'vitest';
import {
	isSidebarOpen,
	setSidebarOpen,
	getProjectContext,
	registerProjectContext,
	clearProjectContext,
	type ProjectContext
} from './sidebar.svelte';

describe('sidebar store', () => {
	beforeEach(() => {
		setSidebarOpen(false);
		clearProjectContext();
	});

	describe('isSidebarOpen / setSidebarOpen', () => {
		it('defaults to closed after reset', () => {
			expect(isSidebarOpen()).toBe(false);
		});

		it('opens the sidebar', () => {
			setSidebarOpen(true);
			expect(isSidebarOpen()).toBe(true);
		});

		it('closes the sidebar', () => {
			setSidebarOpen(true);
			setSidebarOpen(false);
			expect(isSidebarOpen()).toBe(false);
		});
	});

	describe('project context', () => {
		it('defaults to null', () => {
			expect(getProjectContext()).toBeNull();
		});

		it('registers and retrieves project context', () => {
			const ctx: ProjectContext = {
				actionGroups: [
					{
						title: 'Test',
						actions: [{ label: 'Action 1', onclick: () => {} }]
					}
				]
			};
			registerProjectContext(ctx);
			expect(getProjectContext()).toBe(ctx);
		});

		it('clears project context', () => {
			registerProjectContext({ actionGroups: [] });
			clearProjectContext();
			expect(getProjectContext()).toBeNull();
		});
	});
});
