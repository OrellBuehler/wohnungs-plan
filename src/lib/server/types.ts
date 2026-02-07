// Re-export Drizzle types from schema
export type {
	User as DBUser,
	Session as DBSession,
	Project as DBProject,
	Branch as DBBranch,
	Floorplan as DBFloorplan,
	Item as DBItem,
	ItemChange as DBItemChange,
	ProjectMember as DBProjectMember,
	ProjectInvite as DBProjectInvite
} from './schema';

// API response types
export interface UserProfile {
	id: string;
	email: string | null;
	name: string | null;
	avatarUrl: string | null;
}

export interface ProjectWithRole {
	id: string;
	ownerId: string;
	name: string;
	currency: string;
	gridSize: number;
	createdAt: Date | null;
	updatedAt: Date | null;
	role: ProjectRole;
}

export type ProjectRole = 'owner' | 'editor' | 'viewer';
