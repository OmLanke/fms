const { Pool } = require('pg')

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is required for migrations')
}

const pool = new Pool({ connectionString })

async function run() {
  await pool.query(`
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
`)

  await pool.query(`
CREATE TABLE IF NOT EXISTS "User" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "password" text NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'USER',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
`)
}

run()
  .then(() => {
    console.log('user-service migration complete')
    return pool.end()
  })
  .catch((error) => {
    console.error('user-service migration failed', error)
    return pool.end().finally(() => process.exit(1))
  })
