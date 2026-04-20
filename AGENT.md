# TicketFlow — Agent Context

## What You Are Building

A distributed event ticket booking platform implemented as microservices. Each service is an independent Node.js/Express application with its own database. They communicate synchronously via REST and asynchronously via a RabbitMQ message bus.

## Technology Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 20 + TypeScript |
| Framework | Express 4 |
| ORM | Prisma (per-service schema) |
| Database | PostgreSQL 15 (one DB per service, separate schemas) |
| Cache / Locking | Redis 7 |
| Message Bus | RabbitMQ 3 |
| API Gateway | Express + `http-proxy-middleware` |
| Auth | JWT (jsonwebtoken) |
| Validation | Zod |
| Testing | Jest + Supertest |
| Package Manager | pnpm workspaces |
| Containerization | Docker + Docker Compose |

---

## Folder Structure to Generate

```
ticketflow/
├── .env.example
├── docker-compose.yml              # production
├── docker-compose.dev.yml          # dev (exposes ports, adds MailHog)
├── pnpm-workspace.yaml
├── package.json                    # root (scripts only)
│
├── gateway/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                # Express app, proxy routes
│       ├── middleware/
│       │   ├── auth.ts             # JWT verify, attach req.user
│       │   └── rateLimiter.ts
│       └── routes.ts               # Route-to-service mapping
│
├── shared/
│   ├── package.json
│   ├── events/
│   │   └── index.ts                # BOOKING_CONFIRMED, PAYMENT_SUCCESS etc.
│   ├── middleware/
│   │   ├── errorHandler.ts
│   │   └── validate.ts             # Zod middleware wrapper
│   └── types/
│       └── index.ts                # User, Event, Booking, Seat interfaces
│
├── services/
│   │
│   ├── user-service/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── prisma/
│   │   │   └── schema.prisma       # User model
│   │   └── src/
│   │       ├── index.ts
│   │       ├── routes/
│   │       │   └── auth.routes.ts  # POST /register, POST /login, GET /me
│   │       ├── controllers/
│   │       │   └── auth.controller.ts
│   │       ├── services/
│   │       │   └── auth.service.ts # bcrypt, JWT sign/verify
│   │       └── schemas/
│   │           └── auth.schema.ts  # Zod schemas
│   │
│   ├── event-service/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── prisma/
│   │   │   └── schema.prisma       # Event, Venue, Schedule models
│   │   └── src/
│   │       ├── index.ts
│   │       ├── routes/
│   │       │   └── event.routes.ts # GET /, GET /:id, POST / (admin)
│   │       ├── controllers/
│   │       │   └── event.controller.ts
│   │       ├── services/
│   │       │   └── event.service.ts
│   │       └── seed.ts
│   │
│   ├── inventory-service/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── prisma/
│   │   │   └── schema.prisma       # Seat, SeatStatus models
│   │   └── src/
│   │       ├── index.ts
│   │       ├── routes/
│   │       │   └── inventory.routes.ts
│   │       ├── controllers/
│   │       │   └── inventory.controller.ts
│   │       ├── services/
│   │       │   └── inventory.service.ts  # Redis SETNX locking logic
│   │       └── redis/
│   │           └── client.ts
│   │
│   ├── booking-service/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── prisma/
│   │   │   └── schema.prisma       # Booking, BookingItem models
│   │   └── src/
│   │       ├── index.ts
│   │       ├── routes/
│   │       │   └── booking.routes.ts  # POST /, GET /:id, POST /:id/confirm
│   │       ├── controllers/
│   │       │   └── booking.controller.ts
│   │       ├── services/
│   │       │   └── booking.service.ts # Orchestrates inventory + payment calls
│   │       └── messaging/
│   │           └── publisher.ts    # Publishes BOOKING_CONFIRMED to RabbitMQ
│   │
│   ├── payment-service/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── prisma/
│   │   │   └── schema.prisma       # Payment, PaymentStatus models
│   │   └── src/
│   │       ├── index.ts
│   │       ├── routes/
│   │       │   └── payment.routes.ts  # POST /charge, GET /:id
│   │       ├── controllers/
│   │       │   └── payment.controller.ts
│   │       └── services/
│   │           └── payment.service.ts  # Mock Stripe: random success/fail
│   │
│   └── notification-service/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── consumer.ts          # RabbitMQ consumer loop
│           ├── handlers/
│           │   └── booking.handler.ts  # Handles BOOKING_CONFIRMED event
│           └── mailer/
│               └── index.ts         # Nodemailer + MailHog in dev
```

---

## Service Contracts

### User Service (`PORT=3001`)

```
POST   /api/users/register     { name, email, password } → { user, token }
POST   /api/users/login        { email, password }        → { token }
GET    /api/users/me           [Auth]                     → { user }
```

### Event Service (`PORT=3002`)

```
GET    /api/events             [public]  → Event[]
GET    /api/events/:id         [public]  → Event
POST   /api/events             [admin]   → Event
PUT    /api/events/:id         [admin]   → Event
```

### Inventory Service (`PORT=3004`)

```
GET    /api/inventory/events/:eventId/seats   → Seat[]
POST   /api/inventory/lock                    { seatIds, bookingId, ttlSeconds } → { locked: boolean }
POST   /api/inventory/release                 { seatIds } → { ok: boolean }
POST   /api/inventory/confirm                 { seatIds } → { ok: boolean }
```

### Booking Service (`PORT=3003`)

```
POST   /api/bookings             [Auth]  { eventId, seatIds } → Booking (PENDING)
GET    /api/bookings/:id         [Auth]  → Booking
GET    /api/bookings/my          [Auth]  → Booking[]
POST   /api/bookings/:id/confirm [Auth]  → Booking (CONFIRMED)
POST   /api/bookings/:id/cancel  [Auth]  → Booking (CANCELLED)
```

### Payment Service (`PORT=3005`)

```
POST   /api/payments/charge   { bookingId, amount, currency } → Payment
GET    /api/payments/:id      → Payment
```

### Notification Service (`PORT=3006`)

```
# No HTTP API — pure RabbitMQ consumer
# Listens on queue: notifications
# Handles events: BOOKING_CONFIRMED, PAYMENT_FAILED
```

---

## Critical Implementation Rules

### 1. Seat Locking (Inventory Service)

Seat locking MUST be atomic. Use Redis `SETNX` with a TTL:

```typescript
// Lock a seat (returns false if already locked by someone else)
async function lockSeat(seatId: string, bookingId: string, ttl = 300): Promise<boolean> {
  const key = `seat:lock:${seatId}`;
  const result = await redis.set(key, bookingId, 'NX', 'EX', ttl);
  return result === 'OK';
}
```

- Lock TTL: 5 minutes (300 seconds)
- If ANY seat in a batch fails to lock, release ALL already-locked seats and return 409
- On booking cancellation, release all seat locks

### 2. Booking Orchestration (Booking Service)

The booking service must follow this exact sequence:

```
1. Validate request (Zod)
2. Check event exists (call Event Service)
3. Attempt seat locks (call Inventory Service)
   → If 409: return 409 immediately, do NOT create booking record
4. Create PENDING booking record in DB
5. Call Payment Service
   → If payment fails: release seat locks, mark booking FAILED, return 402
6. Confirm seat reservation (call Inventory Service /confirm)
7. Mark booking CONFIRMED in DB
8. Publish BOOKING_CONFIRMED event to RabbitMQ
9. Return booking to client
```

### 3. RabbitMQ Events

Use this shared event schema (from `shared/events`):

```typescript
export const Events = {
  BOOKING_CONFIRMED: 'booking.confirmed',
  BOOKING_CANCELLED: 'booking.cancelled',
  PAYMENT_SUCCESS:   'payment.success',
  PAYMENT_FAILED:    'payment.failed',
  NOTIFY_SEND:       'notify.send',
} as const;

export interface BookingConfirmedPayload {
  bookingId: string;
  userId: string;
  userEmail: string;
  eventId: string;
  eventName: string;
  seatIds: string[];
  totalAmount: number;
  confirmedAt: string; // ISO string
}
```

### 4. Error Handling Standards

Every service must use the shared `errorHandler` middleware. All errors should follow:

```json
{
  "error": {
    "code": "SEAT_LOCKED",
    "message": "One or more seats are unavailable",
    "details": { "conflictingSeatIds": ["A1"] }
  }
}
```

HTTP status codes:
- `400` Bad Request (validation)
- `401` Unauthorized (missing/invalid JWT)
- `403` Forbidden (insufficient permissions)
- `404` Not Found
- `409` Conflict (seat already locked)
- `402` Payment Required (payment failed)
- `500` Internal Server Error

### 5. Service-to-Service Communication

Services call each other via HTTP using `axios`. Use environment variables for URLs:

```typescript
const INVENTORY_URL = process.env.INVENTORY_SERVICE_URL || 'http://localhost:3004';
```

No service should ever import code from another service's folder — only through `shared/`.

---

## Prisma Schema Conventions

All schemas must follow:
- `id String @id @default(cuid())`
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`
- Enum values in SCREAMING_SNAKE_CASE

Example booking model:

```prisma
enum BookingStatus {
  PENDING
  CONFIRMED
  FAILED
  CANCELLED
}

model Booking {
  id          String        @id @default(cuid())
  userId      String
  eventId     String
  status      BookingStatus @default(PENDING)
  totalAmount Decimal       @db.Decimal(10, 2)
  items       BookingItem[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}

model BookingItem {
  id        String  @id @default(cuid())
  bookingId String
  seatId    String
  booking   Booking @relation(fields: [bookingId], references: [id])
}
```

---

## Docker Compose Services (dev)

```yaml
# docker-compose.dev.yml must define:
- postgres:15        # single instance, multiple databases via init scripts
- redis:7-alpine
- rabbitmq:3-management  # exposes :5672 and :15672 (management UI)
- axllent/mailpit        # SMTP mock, UI at :8025
```

---

## Testing Requirements

Each service needs:
1. **Unit tests** for service layer (mock Prisma, Redis, RabbitMQ)
2. **Integration tests** for HTTP routes (Supertest, real Prisma against test DB)

The booking service needs a specific concurrency test:

```typescript
it('should only allow one booking per seat under concurrent load', async () => {
  const promises = Array.from({ length: 20 }, () =>
    request(app).post('/api/bookings').send({ eventId, seatIds: ['A1'] })
  );
  const results = await Promise.all(promises);
  const successes = results.filter(r => r.status === 201);
  const conflicts  = results.filter(r => r.status === 409);
  expect(successes).toHaveLength(1);
  expect(conflicts).toHaveLength(19);
});
```

---

## What NOT to Do

- Do NOT share a database between services
- Do NOT import from another service's `src/` directly
- Do NOT use synchronous locks for seat locking — only Redis atomic operations
- Do NOT skip the PENDING state — booking must go PENDING before payment
- Do NOT publish RabbitMQ events before the DB write is committed
- Do NOT use `any` TypeScript types — every function must be fully typed
