import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { initializeDatabase } from './init';

// Initialize database connection and run migrations
let dbInstance: ReturnType<typeof drizzle<typeof schema>>;
let poolInstance: Pool;
let isInitialized = false;
let initPromise: Promise<{ db: ReturnType<typeof drizzle<typeof schema>>; pool: Pool }> | null = null;

export async function getDatabase() {
  if (!isInitialized) {
    if (!initPromise) {
      initPromise = initializeDatabase();
    }
    const { db: initializedDb, pool: initializedPool } = await initPromise;
    dbInstance = initializedDb;
    poolInstance = initializedPool;
    isInitialized = true;
  }
  return { db: dbInstance, pool: poolInstance };
}

// Export async functions that ensure database is initialized
export async function getDb() {
  const { db } = await getDatabase();
  return db;
}

export async function getPool() {
  const { pool } = await getDatabase();
  return pool;
}

// For backward compatibility, export the database instance
// This will be initialized when first accessed
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_, prop) {
    if (!isInitialized) {
      throw new Error('Database not initialized. Please await getDatabase() first.');
    }
    return dbInstance[prop as keyof typeof dbInstance];
  }
});

// Export the pool instance
export const pool = new Proxy({} as Pool, {
  get(_, prop) {
    if (!isInitialized) {
      throw new Error('Pool not initialized. Please await getDatabase() first.');
    }
    return poolInstance[prop as keyof typeof poolInstance];
  }
});

// Initialize database when this module is imported
getDatabase().catch(console.error);
