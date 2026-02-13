import { and, desc, eq, isNull } from 'drizzle-orm';
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { compare, hash } from 'bcrypt';
import { getDB, shareLinks, type ShareLink, type Item } from './db';
import { config } from './env';

const SHARE_PASSWORD_SALT_ROUNDS = 10;
const SHARE_COOKIE_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24h

export interface CreateShareLinkInput {
	label?: string;
	password?: string;
	expiresAt?: Date | string | null;
}

export function generateShareToken(): string {
	return randomBytes(32).toString('base64url');
}

function normalizeExpiry(value?: Date | string | null): Date | null {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

export async function createShareLink(
	projectId: string,
	createdBy: string,
	input: CreateShareLinkInput = {}
): Promise<ShareLink> {
	const db = getDB();
	const normalizedLabel = typeof input.label === 'string' ? input.label.trim() : '';
	const normalizedPassword = typeof input.password === 'string' ? input.password : '';
	const passwordHash =
		normalizedPassword.length > 0
			? await hash(normalizedPassword, SHARE_PASSWORD_SALT_ROUNDS)
			: null;
	const expiresAt = normalizeExpiry(input.expiresAt);

	// Token collisions are extremely unlikely, but retry on unique conflicts.
	for (let attempt = 0; attempt < 5; attempt += 1) {
		const token = generateShareToken();
		try {
			const [link] = await db
				.insert(shareLinks)
				.values({
					projectId,
					createdBy,
					token,
					label: normalizedLabel || null,
					passwordHash,
					expiresAt
				})
				.returning();
			return link;
		} catch (err) {
			if (err instanceof Error && err.message.includes('share_links_token_unique')) {
				continue;
			}
			throw err;
		}
	}

	throw new Error('Unable to generate unique share token');
}

export async function getShareLinkByToken(token: string): Promise<ShareLink | null> {
	const db = getDB();
	const [link] = await db
		.select()
		.from(shareLinks)
		.where(and(eq(shareLinks.token, token), isNull(shareLinks.revokedAt)));
	return link ?? null;
}

export async function getProjectShareLinks(projectId: string): Promise<ShareLink[]> {
	const db = getDB();
	return db
		.select()
		.from(shareLinks)
		.where(and(eq(shareLinks.projectId, projectId), isNull(shareLinks.revokedAt)))
		.orderBy(desc(shareLinks.createdAt));
}

export async function revokeShareLink(linkId: string, projectId: string): Promise<ShareLink | null> {
	const db = getDB();
	const [link] = await db
		.update(shareLinks)
		.set({ revokedAt: new Date() })
		.where(and(eq(shareLinks.id, linkId), eq(shareLinks.projectId, projectId), isNull(shareLinks.revokedAt)))
		.returning();
	return link ?? null;
}

export async function verifySharePassword(link: ShareLink, password: string): Promise<boolean> {
	if (!link.passwordHash) return true;
	if (!password) return false;
	return compare(password, link.passwordHash);
}

export function isShareLinkValid(link: Pick<ShareLink, 'revokedAt' | 'expiresAt'>): boolean {
	if (link.revokedAt) return false;
	if (link.expiresAt && link.expiresAt <= new Date()) return false;
	return true;
}

export function getShareAuthCookieName(token: string): string {
	return `share_auth_${token.slice(0, 8)}`;
}

function createShareAuthSignature(linkId: string, token: string): string {
	return createHmac('sha256', config.session.secret).update(`${linkId}:${token}`).digest('base64url');
}

export function createShareAuthCookie(linkId: string, token: string): string {
	const signature = createShareAuthSignature(linkId, token);
	return `${token}.${signature}`;
}

export function verifyShareAuthCookie(cookieValue: string, linkId: string): boolean {
	if (!cookieValue) return false;
	const [token, signature] = cookieValue.split('.');
	if (!token || !signature) return false;

	const expectedSignature = createShareAuthSignature(linkId, token);
	const provided = Buffer.from(signature);
	const expected = Buffer.from(expectedSignature);
	if (provided.length !== expected.length) return false;

	return timingSafeEqual(provided, expected);
}

export function getShareAuthCookieExpires(expiresAt: Date | null): Date {
	const maxLifetime = new Date(Date.now() + SHARE_COOKIE_LIFETIME_MS);
	if (!expiresAt) return maxLifetime;
	return expiresAt < maxLifetime ? expiresAt : maxLifetime;
}

export function sanitizeItemsForShare(items: Item[]) {
	return items.map((item) => ({
		id: item.id,
		branchId: item.branchId,
		name: item.name,
		width: item.width,
		height: item.height,
		x: item.x,
		y: item.y,
		rotation: item.rotation,
		color: item.color,
		price: item.price,
		priceCurrency: item.priceCurrency,
		productUrl: item.productUrl,
		shape: item.shape,
		cutoutWidth: item.cutoutWidth,
		cutoutHeight: item.cutoutHeight,
		cutoutCorner: item.cutoutCorner,
		createdAt: item.createdAt,
		updatedAt: item.updatedAt
	}));
}
