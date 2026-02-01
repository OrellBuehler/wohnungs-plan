import { getDB } from './db';
import type { DBItem } from './types';

export async function createItem(
	projectId: string,
	data: Omit<DBItem, 'project_id' | 'created_at' | 'updated_at'>
): Promise<DBItem> {
	const db = getDB();
	const [item] = data.id
		? await db`
				INSERT INTO items (
					id, project_id, name, width, height, x, y, rotation, color,
					price, price_currency, product_url, shape,
					cutout_width, cutout_height, cutout_corner
				) VALUES (
					${data.id}, ${projectId}, ${data.name}, ${data.width}, ${data.height},
					${data.x}, ${data.y}, ${data.rotation}, ${data.color},
					${data.price}, ${data.price_currency}, ${data.product_url},
					${data.shape}, ${data.cutout_width}, ${data.cutout_height}, ${data.cutout_corner}
				)
				RETURNING *
			`
		: await db`
				INSERT INTO items (
					project_id, name, width, height, x, y, rotation, color,
					price, price_currency, product_url, shape,
					cutout_width, cutout_height, cutout_corner
				) VALUES (
					${projectId}, ${data.name}, ${data.width}, ${data.height},
					${data.x}, ${data.y}, ${data.rotation}, ${data.color},
					${data.price}, ${data.price_currency}, ${data.product_url},
					${data.shape}, ${data.cutout_width}, ${data.cutout_height}, ${data.cutout_corner}
				)
				RETURNING *
			`;

	// Update project timestamp
	await db`UPDATE projects SET updated_at = NOW() WHERE id = ${projectId}`;

	return item as DBItem;
}

export async function updateItem(
	itemId: string,
	data: Partial<Omit<DBItem, 'id' | 'project_id' | 'created_at' | 'updated_at'>>
): Promise<DBItem> {
	const db = getDB();

	// Build dynamic update - only update provided fields
	const [item] = await db`
		UPDATE items SET
			name = COALESCE(${data.name ?? null}, name),
			width = COALESCE(${data.width ?? null}, width),
			height = COALESCE(${data.height ?? null}, height),
			x = ${data.x !== undefined ? data.x : null},
			y = ${data.y !== undefined ? data.y : null},
			rotation = COALESCE(${data.rotation ?? null}, rotation),
			color = COALESCE(${data.color ?? null}, color),
			price = ${data.price !== undefined ? data.price : null},
			price_currency = COALESCE(${data.price_currency ?? null}, price_currency),
			product_url = ${data.product_url !== undefined ? data.product_url : null},
			shape = COALESCE(${data.shape ?? null}, shape),
			cutout_width = ${data.cutout_width !== undefined ? data.cutout_width : null},
			cutout_height = ${data.cutout_height !== undefined ? data.cutout_height : null},
			cutout_corner = ${data.cutout_corner !== undefined ? data.cutout_corner : null},
			updated_at = NOW()
		WHERE id = ${itemId}
		RETURNING *
	`;

	// Update project timestamp
	if (item) {
		await db`UPDATE projects SET updated_at = NOW() WHERE id = ${item.project_id}`;
	}

	return item as DBItem;
}

export async function deleteItem(itemId: string): Promise<void> {
	const db = getDB();
	const [item] = await db`DELETE FROM items WHERE id = ${itemId} RETURNING project_id`;
	if (item) {
		await db`UPDATE projects SET updated_at = NOW() WHERE id = ${item.project_id}`;
	}
}

export async function getItemById(itemId: string): Promise<DBItem | null> {
	const db = getDB();
	const [item] = await db`SELECT * FROM items WHERE id = ${itemId}`;
	return (item as DBItem) ?? null;
}
