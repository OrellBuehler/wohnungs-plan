import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import {
	getDB,
	itemChanges,
	items,
	users,
	type Item,
	type NewItem,
	type NewItemChange
} from './db';
import { touchProject } from './projects';

const ITEM_UPDATE_FIELDS = [
	'name',
	'width',
	'height',
	'x',
	'y',
	'rotation',
	'color',
	'price',
	'priceCurrency',
	'productUrl',
	'shape',
	'cutoutWidth',
	'cutoutHeight',
	'cutoutCorner'
] as const;

export type ItemCreateInput = Partial<Omit<Item, 'projectId' | 'branchId' | 'createdAt' | 'updatedAt'>> & {
	name: string;
	width: number;
	height: number;
};

export type ItemUpdateInput = Partial<Omit<Item, 'id' | 'projectId' | 'branchId' | 'createdAt' | 'updatedAt'>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseItemCreateBody(body: Record<string, any>): ItemCreateInput {
	return {
		id: body.id,
		name: body.name,
		width: body.width,
		height: body.height,
		x: body.x ?? null,
		y: body.y ?? null,
		rotation: body.rotation ?? 0,
		color: body.color ?? '#3b82f6',
		price: body.price ?? null,
		priceCurrency: body.priceCurrency ?? 'EUR',
		productUrl: body.productUrl ?? null,
		shape: body.shape ?? 'rectangle',
		cutoutWidth: body.cutoutWidth ?? null,
		cutoutHeight: body.cutoutHeight ?? null,
		cutoutCorner: body.cutoutCorner ?? null
	};
}

export interface ItemChangeWithUser {
	id: string;
	projectId: string;
	branchId: string;
	itemId: string;
	userId: string | null;
	action: 'create' | 'update' | 'delete';
	field: string | null;
	oldValue: string | null;
	newValue: string | null;
	createdAt: Date | null;
	userName: string | null;
	userAvatarUrl: string | null;
}

function toJsonValue(value: unknown): string {
	return JSON.stringify(value);
}

function fromJsonValue(value: string | null): unknown {
	if (value === null) return null;
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

function normalizeItemForHistory(item: Item): Record<string, unknown> {
	return {
		id: item.id,
		projectId: item.projectId,
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
		cutoutCorner: item.cutoutCorner
	};
}

async function insertHistoryEntries(entries: NewItemChange[]): Promise<void> {
	if (entries.length === 0) return;
	const db = getDB();
	await db.insert(itemChanges).values(entries);
}

function itemUpdateDataFromInput(data: ItemUpdateInput): Partial<NewItem> {
	const updateData: Partial<NewItem> = { updatedAt: new Date() };
	for (const field of ITEM_UPDATE_FIELDS) {
		if (data[field] !== undefined) {
			(updateData as Record<string, unknown>)[field] = data[field];
		}
	}
	return updateData;
}

function itemCreateDataFromInput(projectId: string, branchId: string, data: ItemCreateInput): NewItem {
	return {
		...(data.id ? { id: data.id } : {}),
		projectId,
		branchId,
		name: data.name,
		width: data.width,
		height: data.height,
		x: data.x ?? null,
		y: data.y ?? null,
		rotation: data.rotation ?? 0,
		color: data.color ?? '#3b82f6',
		price: data.price ?? null,
		priceCurrency: data.priceCurrency ?? 'EUR',
		productUrl: data.productUrl ?? null,
		shape: data.shape ?? 'rectangle',
		cutoutWidth: data.cutoutWidth ?? null,
		cutoutHeight: data.cutoutHeight ?? null,
		cutoutCorner: data.cutoutCorner ?? null
	};
}

async function createItemDirect(projectId: string, branchId: string, data: ItemCreateInput): Promise<Item> {
	const db = getDB();
	const [item] = await db.insert(items).values(itemCreateDataFromInput(projectId, branchId, data)).returning();
	return item;
}

export async function createItem(
	projectId: string,
	branchId: string,
	userId: string | null,
	data: ItemCreateInput
): Promise<Item> {
	const createdAt = new Date();
	const item = await createItemDirect(projectId, branchId, data);
	await insertHistoryEntries([
		{
			projectId,
			branchId,
			itemId: item.id,
			userId,
			action: 'create',
			field: null,
			oldValue: null,
			newValue: toJsonValue(normalizeItemForHistory(item)),
			createdAt
		}
	]);
	await touchProject(projectId);
	return item;
}

export async function getBranchItems(projectId: string, branchId: string): Promise<Item[]> {
	const db = getDB();
	return db
		.select()
		.from(items)
		.where(and(eq(items.projectId, projectId), eq(items.branchId, branchId)))
		.orderBy(asc(items.createdAt));
}

export async function getItemById(projectId: string, branchId: string, itemId: string): Promise<Item | null> {
	const db = getDB();
	const [item] = await db
		.select()
		.from(items)
		.where(and(eq(items.id, itemId), eq(items.projectId, projectId), eq(items.branchId, branchId)));
	return item ?? null;
}

export async function updateItem(
	projectId: string,
	branchId: string,
	itemId: string,
	userId: string | null,
	data: ItemUpdateInput
): Promise<Item | null> {
	const db = getDB();
	const existing = await getItemById(projectId, branchId, itemId);
	if (!existing) return null;

	const createdAt = new Date();
	const updateData = itemUpdateDataFromInput(data);
	const historyEntries: NewItemChange[] = [];

	for (const field of ITEM_UPDATE_FIELDS) {
		if (data[field] === undefined) continue;
		const newValue = data[field];
		const oldValue = existing[field];
		if (Object.is(oldValue, newValue)) continue;

		historyEntries.push({
			projectId,
			branchId,
			itemId,
			userId,
			action: 'update',
			field,
			oldValue: toJsonValue(oldValue),
			newValue: toJsonValue(newValue),
			createdAt
		});
	}

	if (historyEntries.length === 0) {
		return existing;
	}

	const [item] = await db
		.update(items)
		.set(updateData)
		.where(and(eq(items.id, itemId), eq(items.projectId, projectId), eq(items.branchId, branchId)))
		.returning();

	await insertHistoryEntries(historyEntries);
	await touchProject(projectId);
	return item;
}

export async function deleteItem(
	projectId: string,
	branchId: string,
	itemId: string,
	userId: string | null
): Promise<Item | null> {
	const db = getDB();
	const [item] = await db
		.delete(items)
		.where(and(eq(items.id, itemId), eq(items.projectId, projectId), eq(items.branchId, branchId)))
		.returning();

	if (!item) return null;

	await insertHistoryEntries([
		{
			projectId,
			branchId,
			itemId,
			userId,
			action: 'delete',
			field: null,
			oldValue: toJsonValue(normalizeItemForHistory(item)),
			newValue: null,
			createdAt: new Date()
		}
	]);
	await touchProject(projectId);
	return item;
}

function toRestoredItemData(snapshot: Record<string, unknown>, fallbackItemId: string): ItemCreateInput {
	return {
		id: typeof snapshot.id === 'string' ? snapshot.id : fallbackItemId,
		name: typeof snapshot.name === 'string' ? snapshot.name : 'Restored Item',
		width: typeof snapshot.width === 'number' ? snapshot.width : 100,
		height: typeof snapshot.height === 'number' ? snapshot.height : 100,
		x: typeof snapshot.x === 'number' ? snapshot.x : null,
		y: typeof snapshot.y === 'number' ? snapshot.y : null,
		rotation: typeof snapshot.rotation === 'number' ? snapshot.rotation : 0,
		color: typeof snapshot.color === 'string' ? snapshot.color : '#3b82f6',
		price: typeof snapshot.price === 'number' ? snapshot.price : null,
		priceCurrency: typeof snapshot.priceCurrency === 'string' ? snapshot.priceCurrency : 'EUR',
		productUrl: typeof snapshot.productUrl === 'string' ? snapshot.productUrl : null,
		shape:
			snapshot.shape === 'l-shape' || snapshot.shape === 'rectangle' ? snapshot.shape : 'rectangle',
		cutoutWidth: typeof snapshot.cutoutWidth === 'number' ? snapshot.cutoutWidth : null,
		cutoutHeight: typeof snapshot.cutoutHeight === 'number' ? snapshot.cutoutHeight : null,
		cutoutCorner:
			snapshot.cutoutCorner === 'top-left' ||
			snapshot.cutoutCorner === 'top-right' ||
			snapshot.cutoutCorner === 'bottom-left' ||
			snapshot.cutoutCorner === 'bottom-right'
				? snapshot.cutoutCorner
				: null
	};
}

export async function listItemChanges(
	projectId: string,
	branchId: string,
	limit: number,
	offset: number
): Promise<ItemChangeWithUser[]> {
	const db = getDB();
	const rows = await db
		.select({
			id: itemChanges.id,
			projectId: itemChanges.projectId,
			branchId: itemChanges.branchId,
			itemId: itemChanges.itemId,
			userId: itemChanges.userId,
			action: itemChanges.action,
			field: itemChanges.field,
			oldValue: itemChanges.oldValue,
			newValue: itemChanges.newValue,
			createdAt: itemChanges.createdAt,
			userName: users.name,
			userAvatarUrl: users.avatarUrl
		})
		.from(itemChanges)
		.leftJoin(users, eq(itemChanges.userId, users.id))
		.where(and(eq(itemChanges.projectId, projectId), eq(itemChanges.branchId, branchId)))
		.orderBy(desc(itemChanges.createdAt), desc(itemChanges.id))
		.limit(limit)
		.offset(offset);

	return rows as ItemChangeWithUser[];
}

export async function revertItemChanges(
	projectId: string,
	branchId: string,
	userId: string,
	changeIds: string[]
): Promise<void> {
	if (changeIds.length === 0) return;

	const db = getDB();
	const changes = await db
		.select()
		.from(itemChanges)
		.where(
			and(
				eq(itemChanges.projectId, projectId),
				eq(itemChanges.branchId, branchId),
				inArray(itemChanges.id, changeIds)
			)
		);

	if (changes.length !== changeIds.length) {
		throw new Error('One or more changes were not found for this branch');
	}

	const sorted = [...changes].sort((a, b) => {
		const aTime = a.createdAt?.getTime() ?? 0;
		const bTime = b.createdAt?.getTime() ?? 0;
		if (aTime !== bTime) return bTime - aTime;
		return b.id.localeCompare(a.id);
	});

	for (const change of sorted) {
		if (change.action === 'update') {
			if (!change.field) continue;
			const value = fromJsonValue(change.oldValue);
			await updateItem(projectId, branchId, change.itemId, userId, {
				[change.field]: value
			} as ItemUpdateInput);
			continue;
		}

		if (change.action === 'create') {
			await deleteItem(projectId, branchId, change.itemId, userId);
			continue;
		}

		if (change.action === 'delete') {
			const snapshot = fromJsonValue(change.oldValue);
			if (!snapshot || typeof snapshot !== 'object') continue;

			const existing = await getItemById(projectId, branchId, change.itemId);
			if (existing) {
				await updateItem(
					projectId,
					branchId,
					change.itemId,
					userId,
					toRestoredItemData(snapshot as Record<string, unknown>, change.itemId)
				);
			} else {
				await createItem(
					projectId,
					branchId,
					userId,
					toRestoredItemData(snapshot as Record<string, unknown>, change.itemId)
				);
			}
		}
	}
}
