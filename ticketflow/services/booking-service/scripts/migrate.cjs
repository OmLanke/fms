const { Pool } = require('pg')

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is required for migrations')
}

const pool = new Pool({ connectionString })

async function run() {
  await pool.query(`
DO $$ BEGIN
  CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
`)

  await pool.query(`
CREATE TABLE IF NOT EXISTS "Booking" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "eventId" text NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
  "totalAmount" numeric(10, 2) NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
`)

  await pool.query(`
CREATE TABLE IF NOT EXISTS "BookingItem" (
  "id" text PRIMARY KEY,
  "bookingId" text NOT NULL REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "seatId" text NOT NULL
);
`)
}

run()
  .then(() => {
    console.log('booking-service migration complete')
    return pool.end()
  })
  .catch((error) => {
    console.error('booking-service migration failed', error)
    return pool.end().finally(() => process.exit(1))
  })
