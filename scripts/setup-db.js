#!/usr/bin/env node

/**
 * Database setup script for local development
 * This script helps set up the database locally
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

console.log('🚀 Setting up database for local development...\n');

try {
  // Check if .env exists
  if (!existsSync('.env')) {
    console.log('⚠️  No .env file found. Please create one from env.example');
    console.log('   cp env.example .env');
    console.log('   Then update DATABASE_URL with your local PostgreSQL connection string\n');
  }

  // Generate migrations if they don't exist
  if (!existsSync('drizzle')) {
    console.log('📝 Generating initial migration files...');
    execSync('npm run db:generate', { stdio: 'inherit' });
    console.log('✅ Migration files generated\n');
  }

  console.log('📋 Available database commands:');
  console.log('   npm run db:generate  - Generate new migrations from schema changes');
  console.log('   npm run db:migrate   - Apply migrations to database');
  console.log('   npm run db:push      - Push schema changes directly (dev only)');
  console.log('   npm run db:studio    - Open Drizzle Studio to view/edit data\n');

  console.log('💡 To start development:');
  console.log('   1. Ensure your PostgreSQL database is running');
  console.log('   2. Set DATABASE_URL in your .env file');
  console.log('   3. Run: npm run db:migrate');
  console.log('   4. Run: npm run dev\n');

} catch (error) {
  console.error('❌ Setup failed:', error.message);
  process.exit(1);
}
