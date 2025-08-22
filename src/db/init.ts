import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from './schema';

export async function initializeDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
  });

  const db = drizzle(pool, { schema });

  try {
    console.log('🔄 Running database migrations...');
    
    // Run migrations if they exist
    try {
      await migrate(db, { migrationsFolder: './drizzle' });
      console.log('✅ Database migrations completed successfully');
    } catch (migrationError) {
      // If migrations folder doesn't exist yet, create tables manually
      console.log('⚠️  No migrations found, creating tables manually...');
      await createTablesManually(db);
    }

    console.log('✅ Database initialization completed');
    return { db, pool };
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

async function createTablesManually(db: any) {
  // Create users table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      stripe_customer_id TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      is_premium INTEGER DEFAULT 0,
      export_credits INTEGER DEFAULT 0,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      email_verification_token TEXT,
      email_verification_expires TIMESTAMP,
      subscription_tier TEXT DEFAULT 'free',
      subscription_status TEXT DEFAULT 'inactive',
      current_period_end TIMESTAMP
    )
  `);

  // Create plans table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      markdown TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      baby_age_months INTEGER
    )
  `);

  // Create indexes
  await db.execute('CREATE INDEX IF NOT EXISTS email_idx ON users(email)');
  await db.execute('CREATE INDEX IF NOT EXISTS stripe_customer_idx ON users(stripe_customer_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS user_id_idx ON plans(user_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS created_at_idx ON plans(created_at)');

  console.log('✅ Tables created manually');
}
