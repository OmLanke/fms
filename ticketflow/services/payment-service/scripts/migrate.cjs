const { Pool } = require('pg')

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is required for migrations')
}

const pool = new Pool({ connectionString })

async function run() {
  await pool.query(`
DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
`)

  await pool.query(`
CREATE TABLE IF NOT EXISTS "Payment" (
  "id" text PRIMARY KEY,
  "bookingId" text NOT NULL,
  "amount" numeric(10, 2) NOT NULL,
  "currency" text NOT NULL DEFAULT 'USD',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
`)
}

run()
  .then(() => {
    console.log('payment-service migration complete')
    return pool.end()
  })
  .catch((error) => {
    console.error('payment-service migration failed', error)
    return pool.end().finally(() => process.exit(1))
  })
