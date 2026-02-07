import { and, asc, count, eq } from 'drizzle-orm';
import { getDB, branches, items, projects, type Branch, type Item } from './db';

export const MAIN_BRANCH_NAME = 'Main';

export async function listProjectBranches(projectId: string): Promise<Branch[]> {
	const db = getDB();
	return db
		.select()
		.from(branches)
		.where(eq(branches.projectId, projectId))
		.orderBy(asc(branches.createdAt), asc(branches.id));
}

export async function getBranchById(projectId: string, branchId: string): Promise<Branch | null> {
	const db = getDB();
	const [branch] = await db
		.select()
		.from(branches)
		.where(and(eq(branches.projectId, projectId), eq(branches.id, branchId)));
	return branch ?? null;
}

export async function getMainBranch(projectId: string): Promise<Branch | null> {
	const db = getDB();
	const [branch] = await db
		.select()
		.from(branches)
		.where(and(eq(branches.projectId, projectId), eq(branches.name, MAIN_BRANCH_NAME)));
	return branch ?? null;
}

export async function getDefaultBranch(projectId: string): Promise<Branch | null> {
	const db = getDB();
	const [branch] = await db
		.select()
		.from(branches)
		.where(eq(branches.projectId, projectId))
		.orderBy(asc(branches.createdAt), asc(branches.id))
		.limit(1);
	return branch ?? null;
}

async function touchProject(projectId: string): Promise<void> {
	const db = getDB();
	await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));
}

export async function ensureMainBranch(projectId: string, ownerId: string): Promise<Branch> {
	const existing = await getMainBranch(projectId);
	if (existing) return existing;

	const db = getDB();
	const [branch] = await db
		.insert(branches)
		.values({
			projectId,
			name: MAIN_BRANCH_NAME,
			createdBy: ownerId
		})
		.returning();

	return branch;
}

export async function createBranch(
	projectId: string,
	createdBy: string,
	name: string,
	forkFromBranchId?: string | null
): Promise<Branch> {
	const db = getDB();
	const normalizedName = name.trim();
	if (!normalizedName) {
		throw new Error('Branch name is required');
	}

	const branch = await db.transaction(async (tx) => {
		let forkFrom: Branch | null = null;
		if (forkFromBranchId) {
			const [source] = await tx
				.select()
				.from(branches)
				.where(and(eq(branches.projectId, projectId), eq(branches.id, forkFromBranchId)));
			if (!source) {
				throw new Error('Source branch not found');
			}
			forkFrom = source;
		}

		const [createdBranch] = await tx
			.insert(branches)
			.values({
				projectId,
				name: normalizedName,
				forkedFromId: forkFrom?.id ?? null,
				createdBy
			})
			.returning();

		if (forkFrom) {
			const sourceItems = await tx
				.select()
				.from(items)
				.where(and(eq(items.projectId, projectId), eq(items.branchId, forkFrom.id)));

			if (sourceItems.length > 0) {
				const now = new Date();
				const clonedItems = sourceItems.map((item) => ({
					id: crypto.randomUUID(),
					projectId: item.projectId,
					branchId: createdBranch.id,
					name: item.name,
					width: item.width,
					height: item.height,
					x: item.x,
					y: item.y,
					rotation: item.rotation ?? 0,
					color: item.color,
					price: item.price,
					priceCurrency: item.priceCurrency,
					productUrl: item.productUrl,
					shape: item.shape,
					cutoutWidth: item.cutoutWidth,
					cutoutHeight: item.cutoutHeight,
					cutoutCorner: item.cutoutCorner,
					createdAt: now,
					updatedAt: now
				})) satisfies Partial<Item>[];

				await tx.insert(items).values(clonedItems);
			}
		}

		await tx.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));
		return createdBranch;
	});

	return branch;
}

export async function renameBranch(
	projectId: string,
	branchId: string,
	name: string
): Promise<Branch | null> {
	const db = getDB();
	const normalizedName = name.trim();
	if (!normalizedName) {
		throw new Error('Branch name is required');
	}
	const [branch] = await db
		.update(branches)
		.set({ name: normalizedName })
		.where(and(eq(branches.projectId, projectId), eq(branches.id, branchId)))
		.returning();

	if (branch) {
		await touchProject(projectId);
	}

	return branch ?? null;
}

export async function deleteBranch(projectId: string, branchId: string): Promise<Branch | null> {
	const db = getDB();
	const [countResult] = await db
		.select({ value: count() })
		.from(branches)
		.where(eq(branches.projectId, projectId));

	const branchCount = Number(countResult?.value ?? 0);
	if (branchCount <= 1) {
		throw new Error('Cannot delete the last remaining branch');
	}

	const [deleted] = await db
		.delete(branches)
		.where(and(eq(branches.projectId, projectId), eq(branches.id, branchId)))
		.returning();

	if (deleted) {
		await touchProject(projectId);
	}

	return deleted ?? null;
}
