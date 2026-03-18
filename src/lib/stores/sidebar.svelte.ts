import type { Component } from 'svelte';
import type { IconProps } from '@lucide/svelte';

export interface ProjectAction {
	label: string;
	icon?: Component<IconProps>;
	onclick: () => void;
	disabled?: boolean;
	indicator?: string;
}

export interface ProjectActionGroup {
	title: string;
	actions: ProjectAction[];
}

export interface BranchContext {
	branches: { id: string; name: string }[];
	activeBranchId: string | null;
	defaultBranchId: string | null;
	isSwitching: boolean;
	onSelect: (branchId: string) => void;
	onCreate: () => void;
	onRename: () => void;
	onDelete: () => void;
	canDelete: boolean;
}

export interface ProjectContext {
	actionGroups: ProjectActionGroup[];
	branch?: BranchContext;
}

let open = $state(false);
let projectContext = $state<ProjectContext | null>(null);

export function isSidebarOpen(): boolean {
	return open;
}

export function setSidebarOpen(value: boolean): void {
	open = value;
}

export function getProjectContext(): ProjectContext | null {
	return projectContext;
}

export function registerProjectContext(ctx: ProjectContext): void {
	projectContext = ctx;
}

export function clearProjectContext(): void {
	projectContext = null;
}
