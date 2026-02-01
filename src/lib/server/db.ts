import { drizzle } from 'drizzle-orm/bun-sql';
import { SQL } from 'bun';
import { config } from './env';
import * as schema from './schema';

let client: SQL | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDB() {
	if (!db) {
		if (!config.database.url) {
			throw new Error('DATABASE_URL environment variable is not set');
		}
		client = new SQL(config.database.url);
		db = drizzle({ client, schema });
	}
	return db;
}

export async function closeDB(): Promise<void> {
	if (client) {
		await client.close();
		client = null;
		db = null;
	}
}

// Re-export schema for convenience
export * from './schema';
