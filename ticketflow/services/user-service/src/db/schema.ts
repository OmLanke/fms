import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('User', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  role: text('role').notNull().default('USER'),
  createdAt: timestamp('createdAt', { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: false }).notNull().defaultNow(),
})

export type UserRow = typeof users.$inferSelect
