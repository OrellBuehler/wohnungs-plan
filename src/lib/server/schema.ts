import {
	pgTable,
	type AnyPgColumn,
	uuid,
	text,
	timestamp,
	integer,
	real,
	primaryKey,
	index,
	uniqueIndex,
	check
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Users (from Infomaniak OIDC)
export const users = pgTable('users', {
	id: uuid('id').primaryKey().defaultRandom(),
	infomaniakSub: text('infomaniak_sub').unique().notNull(),
	email: text('email'),
	name: text('name'),
	avatarUrl: text('avatar_url'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
});

// Sessions
export const sessions = pgTable(
	'sessions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		refreshToken: text('refresh_token'),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
	},
	(table) => [
		index('idx_sessions_user_id').on(table.userId),
		index('idx_sessions_expires_at').on(table.expiresAt)
	]
);

// Projects
export const projects = pgTable(
	'projects',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		ownerId: uuid('owner_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		currency: text('currency').notNull().default('EUR'),
		gridSize: integer('grid_size').notNull().default(20),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
	},
	(table) => [index('idx_projects_owner_id').on(table.ownerId)]
);

// Branches (project layout variants)
export const branches = pgTable(
	'branches',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		projectId: uuid('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		forkedFromId: uuid('forked_from_id').references((): AnyPgColumn => branches.id, {
			onDelete: 'set null'
		}),
		createdBy: uuid('created_by')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
	},
	(table) => [
		index('idx_branches_project_id').on(table.projectId),
		index('idx_branches_created_at').on(table.createdAt),
		uniqueIndex('idx_branches_project_name').on(table.projectId, table.name)
	]
);

// Floorplans
export const floorplans = pgTable(
	'floorplans',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		projectId: uuid('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		filename: text('filename').notNull(),
		originalName: text('original_name'),
		mimeType: text('mime_type').notNull(),
		sizeBytes: integer('size_bytes').notNull(),
		scale: real('scale'),
		referenceLength: real('reference_length'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
	},
	(table) => [index('idx_floorplans_project_id').on(table.projectId)]
);

// Items (furniture)
export const items = pgTable(
	'items',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		projectId: uuid('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		branchId: uuid('branch_id')
			.notNull()
			.references(() => branches.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		width: real('width').notNull(),
		height: real('height').notNull(),
		x: real('x'),
		y: real('y'),
		rotation: real('rotation').default(0),
		color: text('color').notNull().default('#3b82f6'),
		price: real('price'),
		priceCurrency: text('price_currency').default('EUR'),
		productUrl: text('product_url'),
		shape: text('shape').notNull().default('rectangle'),
		cutoutWidth: real('cutout_width'),
		cutoutHeight: real('cutout_height'),
		cutoutCorner: text('cutout_corner'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
	},
	(table) => [
		index('idx_items_project_id').on(table.projectId),
		index('idx_items_branch_id').on(table.branchId)
	]
);

// Item change history
export const itemChanges = pgTable(
	'item_changes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		projectId: uuid('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		branchId: uuid('branch_id')
			.notNull()
			.references(() => branches.id, { onDelete: 'cascade' }),
		itemId: uuid('item_id').notNull(),
		userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
		action: text('action').notNull(),
		field: text('field'),
		oldValue: text('old_value'),
		newValue: text('new_value'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
	},
	(table) => [
		index('idx_item_changes_project_id').on(table.projectId),
		index('idx_item_changes_branch_id').on(table.branchId),
		index('idx_item_changes_item_id').on(table.itemId),
		index('idx_item_changes_created_at').on(table.createdAt),
		check('item_changes_action_check', sql`action IN ('create', 'update', 'delete')`)
	]
);

// Project members (sharing)
export const projectMembers = pgTable(
	'project_members',
	{
		projectId: uuid('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		role: text('role').notNull(),
		invitedAt: timestamp('invited_at', { withTimezone: true }).defaultNow()
	},
	(table) => [
		primaryKey({ columns: [table.projectId, table.userId] }),
		index('idx_project_members_user_id').on(table.userId),
		check('project_members_role_check', sql`role IN ('owner', 'editor', 'viewer')`)
	]
);

// Project invites
export const projectInvites = pgTable(
	'project_invites',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		projectId: uuid('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		email: text('email').notNull(),
		role: text('role').notNull(),
		token: text('token').unique().notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		acceptedAt: timestamp('accepted_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
	},
	(table) => [
		index('idx_project_invites_token').on(table.token),
		index('idx_project_invites_email').on(table.email),
		check('project_invites_role_check', sql`role IN ('editor', 'viewer')`)
	]
);

// Public share links (anonymous read-only access)
export const shareLinks = pgTable(
	'share_links',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		projectId: uuid('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		token: text('token').unique().notNull(),
		label: text('label'),
		passwordHash: text('password_hash'),
		expiresAt: timestamp('expires_at', { withTimezone: true }),
		createdBy: uuid('created_by')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		revokedAt: timestamp('revoked_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
	},
	(table) => [
		index('idx_share_links_token').on(table.token),
		index('idx_share_links_project_id').on(table.projectId)
	]
);

// OAuth Clients - per-user or dynamically registered (RFC 7591)
export const oauthClients = pgTable(
	'oauth_clients',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
		clientId: text('client_id').unique().notNull(),
		clientSecretHash: text('client_secret_hash'),
		clientName: text('client_name'),
		allowedRedirectUris: text('allowed_redirect_uris').array().notNull().default(sql`ARRAY[]::text[]`),
		tokenEndpointAuthMethod: text('token_endpoint_auth_method').notNull().default('client_secret_post'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
	},
	(table) => [
		index('idx_oauth_clients_user_id').on(table.userId),
		index('idx_oauth_clients_client_id').on(table.clientId)
	]
);

// OAuth Authorizations - tracks which clients user has approved
export const oauthAuthorizations = pgTable(
	'oauth_authorizations',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		clientId: text('client_id')
			.notNull()
			.references(() => oauthClients.clientId, { onDelete: 'cascade' }),
		approvedAt: timestamp('approved_at', { withTimezone: true }).defaultNow()
	},
	(table) => [
		index('idx_oauth_authorizations_user_id').on(table.userId),
		index('idx_oauth_authorizations_client_id').on(table.clientId),
		uniqueIndex('idx_oauth_authorizations_user_client').on(table.userId, table.clientId)
	]
);

// OAuth Tokens - access and refresh tokens
export const oauthTokens = pgTable(
	'oauth_tokens',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		clientId: text('client_id')
			.notNull()
			.references(() => oauthClients.clientId, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		accessTokenHash: text('access_token_hash').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		scopes: text('scopes').array().notNull().default(sql`ARRAY['mcp:access']::text[]`),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
	},
	(table) => [
		index('idx_oauth_tokens_client_id').on(table.clientId),
		index('idx_oauth_tokens_user_id').on(table.userId),
		index('idx_oauth_tokens_expires_at').on(table.expiresAt),
		index('idx_oauth_tokens_access_token_hash').on(table.accessTokenHash)
	]
);

// OAuth Authorization Codes - short-lived codes for PKCE flow
export const oauthAuthorizationCodes = pgTable(
	'oauth_authorization_codes',
	{
		code: text('code').primaryKey(),
		clientId: text('client_id')
			.notNull()
			.references(() => oauthClients.clientId, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		redirectUri: text('redirect_uri').notNull(),
		codeChallenge: text('code_challenge').notNull(),
		codeChallengeMethod: text('code_challenge_method').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		usedAt: timestamp('used_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
	},
	(table) => [
		index('idx_oauth_codes_client_id').on(table.clientId),
		index('idx_oauth_codes_expires_at').on(table.expiresAt),
		check('oauth_codes_method_check', sql`code_challenge_method = 'S256'`)
	]
);

// Type exports for use in application code
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Branch = typeof branches.$inferSelect;
export type NewBranch = typeof branches.$inferInsert;
export type Floorplan = typeof floorplans.$inferSelect;
export type NewFloorplan = typeof floorplans.$inferInsert;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type ItemChange = typeof itemChanges.$inferSelect;
export type NewItemChange = typeof itemChanges.$inferInsert;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type NewProjectMember = typeof projectMembers.$inferInsert;
export type ProjectInvite = typeof projectInvites.$inferSelect;
export type NewProjectInvite = typeof projectInvites.$inferInsert;
export type ShareLink = typeof shareLinks.$inferSelect;
export type NewShareLink = typeof shareLinks.$inferInsert;
export type OAuthClient = typeof oauthClients.$inferSelect;
export type NewOAuthClient = typeof oauthClients.$inferInsert;
export type OAuthAuthorization = typeof oauthAuthorizations.$inferSelect;
export type NewOAuthAuthorization = typeof oauthAuthorizations.$inferInsert;
export type OAuthToken = typeof oauthTokens.$inferSelect;
export type NewOAuthToken = typeof oauthTokens.$inferInsert;
export type OAuthAuthorizationCode = typeof oauthAuthorizationCodes.$inferSelect;
export type NewOAuthAuthorizationCode = typeof oauthAuthorizationCodes.$inferInsert;
