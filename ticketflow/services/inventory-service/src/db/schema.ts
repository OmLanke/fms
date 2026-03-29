import { pgEnum, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'

export const seatStatusEnum = pgEnum('SeatStatus', ['AVAILABLE', 'LOCKED', 'RESERVED'])

export const seats = pgTable(
  'Seat',
  {
    id: text('id').primaryKey(),
    eventId: text('eventId').notNull(),
    seatNumber: text('seatNumber').notNull(),
    row: text('row').notNull(),
    status: seatStatusEnum('status').notNull().default('AVAILABLE'),
    createdAt: timestamp('createdAt', { withTimezone: false }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: false }).notNull().defaultNow(),
  },
  (table) => ({
    eventRowSeatUnique: unique('Seat_eventId_row_seatNumber_key').on(table.eventId, table.row, table.seatNumber),
  })
)
