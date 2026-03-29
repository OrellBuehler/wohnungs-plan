import { drizzle } from 'drizzle-orm/bun-sql';
import { migrate } from 'drizzle-orm/bun-sql/migrator';
import { SQL } from 'bun';
import { join } from 'node:path';
import { config } from './env';
import * as schema from './schema';
import { logger } from './logger';

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

export async function runMigrations(): Promise<void> {
	if (!config.database.url) {
		logger.warn('DATABASE_URL not set — skipping migrations');
		return;
	}
	const database = getDB();
	// Use absolute path from process.cwd() to ensure correct resolution in Docker
	const migrationsPath = join(process.cwd(), 'drizzle');
	logger.info(`Running database migrations from ${migrationsPath}...`);
	try {
		await migrate(database, { migrationsFolder: migrationsPath });
		logger.info('Migrations completed successfully');
	} catch (error) {
		logger.error('Migration failed:', error);
		throw error;
	}
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
