# Agent Prompt — TicketFlow Microservices Platform

You are implementing **TicketFlow**, a distributed event ticket booking system built with microservices. Read `AGENT.md` fully before writing a single line of code — it contains all contracts, rules, and architectural decisions that must be followed exactly.

---

## Your Task

Generate the complete, working codebase for TicketFlow as described in `AGENT.md` and `INSTRUCTIONS.md`. The implementation must be production-quality TypeScript — no placeholder stubs, no `// TODO` comments, no `any` types.

---

## Implementation Order

Follow this order strictly. Do not jump ahead.

### Phase 1 — Scaffolding
1. `pnpm-workspace.yaml` and root `package.json` (with `dev:all` script)
2. `docker-compose.dev.yml` (Postgres, Redis, RabbitMQ, MailHog)
3. `docker-compose.yml` (production, no exposed debug ports)
4. `.env.example` with every variable documented
5. `shared/` package — event constants, TypeScript interfaces, error handler middleware, Zod validation middleware

### Phase 2 — User Service
- Prisma schema (User model)
- Register, Login, Get Me routes
- bcrypt password hashing
- JWT sign on login, verify middleware in `shared/`
- Full Zod validation on all inputs

### Phase 3 — Event Service
- Prisma schema (Event, Venue, Schedule)
- CRUD routes (GET all, GET by ID, POST/PUT for admin)
- Seed script with 3 sample events, each with 50 seats (rows A-E, seats 1-10)

### Phase 4 — Inventory Service (most critical)
- Prisma schema (Seat, SeatStatus enum: AVAILABLE | LOCKED | RESERVED)
- Redis client setup
- `lockSeat(seatId, bookingId, ttl)` using `SETNX` — atomic, returns boolean
- `releaseSeats(seatIds[])` — batch release
- `confirmSeats(seatIds[])` — moves LOCKED → RESERVED in Postgres
- Batch lock endpoint: locks all requested seats or releases all on partial failure → 409

### Phase 5 — Payment Service
- Prisma schema (Payment, PaymentStatus: PENDING | SUCCESS | FAILED)
- Mock payment logic: succeed with probability from `PAYMENT_SUCCESS_RATE` env var
- Record every attempt in DB
- Return structured response with payment ID

### Phase 6 — Booking Service
- Prisma schema (Booking, BookingItem, BookingStatus)
- Full orchestration flow (see AGENT.md section "Booking Orchestration")
- MUST handle rollback: if payment fails → release seat locks → mark FAILED
- Publish `BOOKING_CONFIRMED` to RabbitMQ after successful DB write
- GET /my for user's booking history

### Phase 7 — Notification Service
- RabbitMQ consumer setup with reconnect logic (retry on disconnect)
- Handle `BOOKING_CONFIRMED` → send confirmation email via Nodemailer (MailHog in dev)
- Email template: plain text, includes event name, seat list, booking ID, total amount
- Handle `PAYMENT_FAILED` → send failure notification

### Phase 8 — API Gateway
- Express app with `http-proxy-middleware`
- Route `/api/users/*` → user-service:3001
- Route `/api/events/*` → event-service:3002
- Route `/api/bookings/*` → booking-service:3003
- Route `/api/inventory/*` → inventory-service:3004
- Route `/api/payments/*` → payment-service:3005
- JWT verification middleware at gateway level (forward decoded user in header)
- Rate limiter: 100 req/min per IP

### Phase 9 — Tests
- Unit tests for booking service orchestration (mock axios calls to inventory + payment)
- Unit tests for inventory service seat locking (mock Redis)
- Integration test for full booking flow (requires test DB)
- Concurrency test: 20 simultaneous booking attempts for the same seat → only 1 succeeds

### Phase 10 — Finish
- `README.md` with a one-paragraph project summary and link to INSTRUCTIONS.md
- Verify all `tsconfig.json` files have `strict: true`
- Verify all services export a named `app` (for testing) and call `app.listen` only in `index.ts`

---

## Non-Negotiable Rules

1. **Every service owns its own DB** — no shared schemas, no cross-service Prisma imports
2. **Seat locking is Redis SETNX only** — no database-level locking, no in-memory maps
3. **Booking state machine**: PENDING → CONFIRMED or PENDING → FAILED. Never skip PENDING.
4. **RabbitMQ events publish after DB commit** — never before
5. **No `any` types anywhere** — use `unknown` and type guards if needed
6. **All HTTP endpoints validate with Zod** — no raw `req.body` access without parsing
7. **Services communicate only via HTTP or RabbitMQ** — no shared memory, no direct imports
8. **The 409 on concurrent seat booking must actually work** — test it, don't stub it

---

## When You Are Done

Confirm by listing:
- [ ] All 6 services start without errors (`pnpm run dev:all`)
- [ ] `docker compose -f docker-compose.dev.yml up -d` brings up all infra
- [ ] The full booking flow works end-to-end via the gateway on port 3000
- [ ] The concurrency test passes (1 success, 19 conflicts for same seat)
- [ ] All migrations run cleanly
- [ ] TypeScript compiles with zero errors (`pnpm run build` in each service)
