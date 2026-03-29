import { numeric, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const paymentStatusEnum = pgEnum('PaymentStatus', ['PENDING', 'SUCCESS', 'FAILED'])

export const payments = pgTable('Payment', {
  id: text('id').primaryKey(),
  bookingId: text('bookingId').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('USD'),
  status: paymentStatusEnum('status').notNull().default('PENDING'),
  createdAt: timestamp('createdAt', { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: false }).notNull().defaultNow(),
})
