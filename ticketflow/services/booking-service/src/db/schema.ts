import { numeric, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const bookingStatusEnum = pgEnum('BookingStatus', ['PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED'])

export const bookings = pgTable('Booking', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  eventId: text('eventId').notNull(),
  status: bookingStatusEnum('status').notNull().default('PENDING'),
  totalAmount: numeric('totalAmount', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('createdAt', { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: false }).notNull().defaultNow(),
})

export const bookingItems = pgTable('BookingItem', {
  id: text('id').primaryKey(),
  bookingId: text('bookingId').notNull(),
  seatId: text('seatId').notNull(),
})
