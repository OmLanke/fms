const { Pool } = require('pg')

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is required for migrations')
}

const pool = new Pool({ connectionString })

async function run() {
  await pool.query(`
CREATE TABLE IF NOT EXISTS "Venue" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "address" text NOT NULL,
  "city" text NOT NULL,
  "country" text NOT NULL,
  "capacity" integer NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
`)

  await pool.query(`
CREATE TABLE IF NOT EXISTS "Event" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "venueId" text NOT NULL REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "date" timestamp NOT NULL,
  "price" numeric(10, 2) NOT NULL,
  "totalSeats" integer NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
`)
}

run()
  .then(() => {
    console.log('event-service migration complete')
    return pool.end()
  })
  .catch((error) => {
    console.error('event-service migration failed', error)
    return pool.end().finally(() => process.exit(1))
  })
