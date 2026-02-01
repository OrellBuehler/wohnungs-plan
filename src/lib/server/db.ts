import { SQL } from 'bun';
import { config } from './env';

let db: SQL | null = null;

export function getDB(): SQL {
	if (!db) {
		if (!config.database.url) {
			throw new Error('DATABASE_URL environment variable is not set');
		}
		db = new SQL(config.database.url);
	}
	return db;
}

export async function closeDB(): Promise<void> {
	if (db) {
		await db.close();
		db = null;
	}
}
