import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { initializeDatabase } from './init';

// Initialize database connection and run migrations
let dbInstance: ReturnType<typeof drizzle>;
let poolInstance: Pool;

export async function getDatabase() {
  if (!dbInstance || !poolInstance) {
    const { db: initializedDb, pool: initializedPool } = await initializeDatabase();
    dbInstance = initializedDb;
    poolInstance = initializedPool;
  }
  return { db: dbInstance, pool: poolInstance };
}

// For backward compatibility, export a promise that resolves to the db
export const dbPromise = getDatabase().then(({ db }) => db);
export const poolPromise = getDatabase().then(({ pool }) => pool);

// Legacy exports (deprecated - use getDatabase() instead)
export const db = dbPromise;
export const pool = poolPromise;
