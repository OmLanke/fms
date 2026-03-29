const { Pool } = require('pg')

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is required for migrations')
}

const pool = new Pool({ connectionString })

async function run() {
  await pool.query(`
DO $$ BEGIN
  CREATE TYPE "SeatStatus" AS ENUM ('AVAILABLE', 'LOCKED', 'RESERVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
`)

  await pool.query(`
CREATE TABLE IF NOT EXISTS "Seat" (
  "id" text PRIMARY KEY,
  "eventId" text NOT NULL,
  "seatNumber" text NOT NULL,
  "row" text NOT NULL,
  "status" "SeatStatus" NOT NULL DEFAULT 'AVAILABLE',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "Seat_eventId_row_seatNumber_key" UNIQUE("eventId", "row", "seatNumber")
);
`)
}

run()
  .then(() => {
    console.log('inventory-service migration complete')
    return pool.end()
  })
  .catch((error) => {
    console.error('inventory-service migration failed', error)
    return pool.end().finally(() => process.exit(1))
  })
