const { randomUUID } = require('crypto')
const { Pool } = require('pg')

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is required for seeding')
}

const pool = new Pool({ connectionString })

const EVENT_IDS = ['event-1', 'event-2', 'event-3']
const ROWS = ['A', 'B', 'C', 'D', 'E']
const SEATS_PER_ROW = 10

async function seedEventSeats(eventId) {
  const values = []
  const params = []
  let i = 1

  for (const row of ROWS) {
    for (let seat = 1; seat <= SEATS_PER_ROW; seat += 1) {
      values.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++})`)
      params.push(randomUUID(), eventId, String(seat), row, 'AVAILABLE')
    }
  }

  const sql = `
    INSERT INTO "Seat" ("id", "eventId", "seatNumber", "row", "status")
    VALUES ${values.join(', ')}
    ON CONFLICT ("eventId", "row", "seatNumber") DO NOTHING;
  `

  await pool.query(sql, params)
}

async function run() {
  for (const eventId of EVENT_IDS) {
    await seedEventSeats(eventId)
  }

  console.log('inventory-service seed complete')
}

run()
  .then(() => pool.end())
  .catch((error) => {
    console.error('inventory-service seed failed', error)
    pool.end().finally(() => process.exit(1))
  })
