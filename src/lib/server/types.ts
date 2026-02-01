export interface DBUser {
	id: string;
	infomaniak_sub: string;
	email: string | null;
	name: string | null;
	avatar_url: string | null;
	created_at: Date;
	updated_at: Date;
}

export interface DBSession {
	id: string;
	user_id: string;
	refresh_token: string | null;
	expires_at: Date;
	created_at: Date;
}

export interface DBProject {
	id: string;
	owner_id: string;
	name: string;
	currency: string;
	grid_size: number;
	created_at: Date;
	updated_at: Date;
}

export interface DBFloorplan {
	id: string;
	project_id: string;
	filename: string;
	original_name: string | null;
	mime_type: string;
	size_bytes: number;
	scale: number | null;
	reference_length: number | null;
	created_at: Date;
	updated_at: Date;
}

export interface DBItem {
	id: string;
	project_id: string;
	name: string;
	width: number;
	height: number;
	x: number | null;
	y: number | null;
	rotation: number;
	color: string;
	price: number | null;
	price_currency: string;
	product_url: string | null;
	shape: string;
	cutout_width: number | null;
	cutout_height: number | null;
	cutout_corner: string | null;
	created_at: Date;
	updated_at: Date;
}

export interface DBProjectMember {
	project_id: string;
	user_id: string;
	role: 'owner' | 'editor' | 'viewer';
	invited_at: Date;
}

export interface DBProjectInvite {
	id: string;
	project_id: string;
	email: string;
	role: 'editor' | 'viewer';
	token: string;
	expires_at: Date;
	accepted_at: Date | null;
	created_at: Date;
}

// API response types
export interface UserProfile {
	id: string;
	email: string | null;
	name: string | null;
	avatarUrl: string | null;
}

export interface ProjectWithRole extends DBProject {
	role: 'owner' | 'editor' | 'viewer';
}

export type ProjectRole = 'owner' | 'editor' | 'viewer';
