# TicketFlow — Setup & Run Instructions

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ | All services are Node/Express |
| Docker + Docker Compose | Latest | Spins up Postgres, Redis, RabbitMQ |
| pnpm | 8+ | Workspace package manager |

```bash
npm install -g pnpm
```

---

## Project Structure (Quick Map)

```
ticketflow/
├── gateway/                  # API Gateway (Express + http-proxy-middleware)
├── services/
│   ├── user-service/         # Auth, JWT, profiles
│   ├── event-service/        # Event listings, venues, schedules
│   ├── booking-service/      # Booking orchestration
│   ├── inventory-service/    # Seat locking (Redis), availability
│   ├── payment-service/      # Payment simulation (Stripe mock)
│   └── notification-service/ # Email/SMS via RabbitMQ consumer
├── shared/
│   ├── middleware/            # Auth middleware, error handler
│   ├── events/                # Shared event name constants
│   └── types/                 # Shared TypeScript interfaces
├── docker-compose.yml
├── docker-compose.dev.yml
├── pnpm-workspace.yaml
└── .env.example
```

---

## First-Time Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url> ticketflow
cd ticketflow
pnpm install          # installs all workspace packages in one shot
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env — see variable reference below
```

### 3. Start infrastructure (Postgres, Redis, RabbitMQ)

```bash
docker compose -f docker-compose.dev.yml up -d
```

Wait ~10 seconds for Postgres to be ready.

### 4. Run database migrations

```bash
pnpm --filter user-service       run migrate
pnpm --filter event-service      run migrate
pnpm --filter booking-service    run migrate
pnpm --filter inventory-service  run migrate
pnpm --filter payment-service    run migrate
```

These commands execute service-local SQL migration scripts used by Drizzle-based services.

### 5. Seed test data (optional but useful)

```bash
pnpm --filter event-service run seed
```

### 6. Start all services in development mode

```bash
pnpm --filter gateway                run dev &
pnpm --filter user-service           run dev &
pnpm --filter event-service          run dev &
pnpm --filter booking-service        run dev &
pnpm --filter inventory-service      run dev &
pnpm --filter payment-service        run dev &
pnpm --filter notification-service   run dev &
```

Or use the convenience scripts at the root:

```bash
pnpm run dev:all
# backend only:
pnpm run dev:backend
```

---

## Service Ports

| Service | Port |
|---------|------|
| API Gateway | 3000 |
| User/Auth | 3001 |
| Event | 3002 |
| Booking | 3003 |
| Inventory | 3004 |
| Payment | 3005 |
| Notification | 3006 |
| RabbitMQ Management UI | 15672 |

---

## Environment Variables Reference (`.env.example`)

```env
# Shared
JWT_SECRET=changeme

# Databases (one per service)
USER_DB_URL=postgresql://postgres:postgres@localhost:5432/users
EVENT_DB_URL=postgresql://postgres:postgres@localhost:5432/events
BOOKING_DB_URL=postgresql://postgres:postgres@localhost:5432/bookings
INVENTORY_DB_URL=postgresql://postgres:postgres@localhost:5432/inventory
PAYMENT_DB_URL=postgresql://postgres:postgres@localhost:5432/payments

# Redis (Inventory service — seat locking)
REDIS_URL=redis://localhost:6379

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# Payment mock
STRIPE_SECRET_KEY=sk_test_mock_key
PAYMENT_SUCCESS_RATE=0.95       # 95% of payments succeed (for testing failures)

# Notification (SMTP mock via MailHog)
SMTP_HOST=localhost
SMTP_PORT=1025
```

---

## Core Booking Flow (for manual testing)

```bash
BASE=http://localhost:3000

# 1. Register a user
curl -X POST $BASE/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Om","email":"om@test.com","password":"secret123"}'

# 2. Login — copy the token from response
TOKEN=$(curl -s -X POST $BASE/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"om@test.com","password":"secret123"}' | jq -r '.token')

# 3. Browse events
curl $BASE/api/events

# 4. Check seat availability for event
curl $BASE/api/inventory/events/:eventId/seats

# 5. Place a booking (attempts seat lock, then charges payment)
curl -X POST $BASE/api/bookings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"eventId":"<id>","seatIds":["A1","A2"]}'

# 6. Confirm booking (triggers notification via message bus)
curl -X POST $BASE/api/bookings/:bookingId/confirm \
  -H "Authorization: Bearer $TOKEN"
```

---

## Testing Concurrency (Race Condition Demo)

The inventory service uses Redis `SETNX` for atomic seat locking. Test it:

```bash
# Fire 10 simultaneous booking attempts for the same seat
for i in {1..10}; do
  curl -s -X POST http://localhost:3000/api/bookings \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"eventId":"event-1","seatIds":["A1"]}' &
done
wait
# Only one should succeed; all others get 409 Conflict
```

---

## Running Tests

```bash
pnpm run test              # all services
pnpm --filter booking-service run test   # single service
pnpm run test:integration  # requires Docker infra running
```

---

## Production Build

```bash
docker compose up --build -d
```

All services are containerized. The `docker-compose.yml` (prod) excludes dev ports and uses environment-specific config.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ECONNREFUSED 5432` | Postgres not ready yet — wait 10s and retry |
| `409 Seat already locked` | Expected behaviour for concurrent booking |
| RabbitMQ not connecting | Check `docker compose ps` — restart infra |
| JWT invalid | Ensure `JWT_SECRET` is same across all services |
