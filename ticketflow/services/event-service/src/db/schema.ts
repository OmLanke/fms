import { integer, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const venues = pgTable('Venue', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  city: text('city').notNull(),
  country: text('country').notNull(),
  capacity: integer('capacity').notNull(),
  createdAt: timestamp('createdAt', { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: false }).notNull().defaultNow(),
})

export const events = pgTable('Event', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  venueId: text('venueId').notNull(),
  date: timestamp('date', { withTimezone: false }).notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  totalSeats: integer('totalSeats').notNull(),
  createdAt: timestamp('createdAt', { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: false }).notNull().defaultNow(),
})
