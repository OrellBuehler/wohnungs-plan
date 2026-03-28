import type { SQL } from 'bun';

export const U1 = '00000000-0000-0000-0001-000000000001';
export const U2 = '00000000-0000-0000-0001-000000000002';
const S1 = '00000000-0000-0000-0002-000000000001';
const P1 = '00000000-0000-0000-0003-000000000001';
const B1 = '00000000-0000-0000-0004-000000000001';
export const I1 = '00000000-0000-0000-0005-000000000001';
export const I2 = '00000000-0000-0000-0005-000000000002';
const IC1 = '00000000-0000-0000-0006-000000000001';
const FP1 = '00000000-0000-0000-0007-000000000001';
const C1 = '00000000-0000-0000-0008-000000000001';
const CR1 = '00000000-0000-0000-0009-000000000001';
const OC1 = '00000000-0000-0000-000a-000000000001';
const SL1 = '00000000-0000-0000-000b-000000000001';
const PI1 = '00000000-0000-0000-000c-000000000001';

export async function seedData(db: SQL): Promise<void> {
	const far = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

	await db`
		INSERT INTO users (id, infomaniak_sub, email, name)
		VALUES
			(${U1}, 'sub-001', 'alice@example.com', 'Alice'),
			(${U2}, 'sub-002', 'bob@example.com', 'Bob')
	`;

	await db`
		INSERT INTO sessions (id, user_id, expires_at)
		VALUES (${S1}, ${U1}, ${far})
	`;

	await db`
		INSERT INTO projects (id, owner_id, name, currency, grid_size)
		VALUES (${P1}, ${U1}, 'Test Project', 'EUR', 20)
	`;

	await db`
		INSERT INTO branches (id, project_id, name, created_by)
		VALUES (${B1}, ${P1}, 'main', ${U1})
	`;

	await db`
		INSERT INTO project_members (project_id, user_id, role)
		VALUES
			(${P1}, ${U1}, 'owner'),
			(${P1}, ${U2}, 'editor')
	`;

	await db`
		INSERT INTO items (id, project_id, branch_id, name, width, height, color, shape)
		VALUES
			(${I1}, ${P1}, ${B1}, 'Sofa', 200, 90, '#3b82f6', 'rectangle'),
			(${I2}, ${P1}, ${B1}, 'Table', 120, 80, '#10b981', 'rectangle')
	`;

	await db`
		INSERT INTO item_changes (id, project_id, branch_id, item_id, user_id, action, via_mcp)
		VALUES (${IC1}, ${P1}, ${B1}, ${I1}, ${U1}, 'create', false)
	`;

	await db`
		INSERT INTO floorplans (id, project_id, filename, mime_type, size_bytes)
		VALUES (${FP1}, ${P1}, 'plan.png', 'image/png', 204800)
	`;

	await db`
		INSERT INTO comments (id, project_id, branch_id, author_id, type, x, y, resolved)
		VALUES (${C1}, ${P1}, ${B1}, ${U1}, 'canvas', 100.0, 200.0, 0)
	`;

	await db`
		INSERT INTO comment_replies (id, comment_id, author_id, body)
		VALUES (${CR1}, ${C1}, ${U2}, 'Looks good!')
	`;

	await db`
		INSERT INTO oauth_clients (id, user_id, client_id, client_secret_hash, client_name, token_endpoint_auth_method)
		VALUES (${OC1}, ${U1}, 'test-client-001', 'hash-placeholder', 'Test Client', 'client_secret_post')
	`;

	await db`
		INSERT INTO share_links (id, project_id, token, created_by)
		VALUES (${SL1}, ${P1}, 'share-token-test-001', ${U1})
	`;

	await db`
		INSERT INTO project_invites (id, project_id, email, role, token, expires_at)
		VALUES (${PI1}, ${P1}, 'charlie@example.com', 'viewer', 'invite-token-001', ${far})
	`;

	console.log('Seeded: 2 users, 1 session, 1 project, 1 branch, 2 members, 2 items, 1 change, 1 floorplan, 1 comment, 1 reply, 1 oauth client, 1 share link, 1 invite');
}
