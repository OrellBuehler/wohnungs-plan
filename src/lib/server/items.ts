import { eq } from 'drizzle-orm';
import { getDB, items, projects, type Item, type NewItem } from './db';

export async function createItem(
	projectId: string,
	data: Partial<Omit<Item, 'projectId' | 'createdAt' | 'updatedAt'>> & { name: string; width: number; height: number }
): Promise<Item> {
	const db = getDB();
	const [item] = await db
		.insert(items)
		.values({
			...(data.id ? { id: data.id } : {}),
			projectId,
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
		})
		.returning();

	// Update project timestamp
	await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));

	return item;
}

export async function updateItem(
	itemId: string,
	data: Partial<Omit<Item, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>
): Promise<Item> {
	const db = getDB();

	const updateData: Record<string, unknown> = { updatedAt: new Date() };
	if (data.name !== undefined) updateData.name = data.name;
	if (data.width !== undefined) updateData.width = data.width;
	if (data.height !== undefined) updateData.height = data.height;
	if (data.x !== undefined) updateData.x = data.x;
	if (data.y !== undefined) updateData.y = data.y;
	if (data.rotation !== undefined) updateData.rotation = data.rotation;
	if (data.color !== undefined) updateData.color = data.color;
	if (data.price !== undefined) updateData.price = data.price;
	if (data.priceCurrency !== undefined) updateData.priceCurrency = data.priceCurrency;
	if (data.productUrl !== undefined) updateData.productUrl = data.productUrl;
	if (data.shape !== undefined) updateData.shape = data.shape;
	if (data.cutoutWidth !== undefined) updateData.cutoutWidth = data.cutoutWidth;
	if (data.cutoutHeight !== undefined) updateData.cutoutHeight = data.cutoutHeight;
	if (data.cutoutCorner !== undefined) updateData.cutoutCorner = data.cutoutCorner;

	const [item] = await db.update(items).set(updateData).where(eq(items.id, itemId)).returning();

	// Update project timestamp
	if (item) {
		await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, item.projectId));
	}

	return item;
}

export async function deleteItem(itemId: string): Promise<void> {
	const db = getDB();
	const [item] = await db.delete(items).where(eq(items.id, itemId)).returning({ projectId: items.projectId });
	if (item) {
		await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, item.projectId));
	}
}

export async function getItemById(itemId: string): Promise<Item | null> {
	const db = getDB();
	const [item] = await db.select().from(items).where(eq(items.id, itemId));
	return item ?? null;
}
