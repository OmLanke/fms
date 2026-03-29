# TicketFlow

TicketFlow is a distributed event ticket booking platform built as a microservices architecture. It allows users to browse events, lock seats atomically using Redis, process payments, and receive email confirmations — all handled by independent Node.js/Express services communicating via REST and RabbitMQ, with Drizzle ORM for service-local data access.

For full setup and run instructions, see [INSTRUCTIONS.md](../INSTRUCTIONS.md).

## Services

| Service | Port | Responsibility |
|---------|------|----------------|
| API Gateway | 3000 | Request routing, rate limiting |
| User Service | 3001 | Authentication, JWT, user profiles |
| Event Service | 3002 | Event listings, venues, schedules |
| Booking Service | 3003 | Booking orchestration |
| Inventory Service | 3004 | Seat locking (Redis SETNX) |
| Payment Service | 3005 | Payment simulation |
| Notification Service | 3006 | Email notifications (RabbitMQ consumer) |

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure
docker compose -f docker-compose.dev.yml up -d

# 3. Run migrations
pnpm --filter user-service run migrate
pnpm --filter event-service run migrate
pnpm --filter booking-service run migrate
pnpm --filter inventory-service run migrate
pnpm --filter payment-service run migrate

# 4. Start full stack (frontend + backend)
pnpm run dev:all

# Or backend only
pnpm run dev:backend
```

## Architecture

Services communicate synchronously via HTTP (using axios) and asynchronously via RabbitMQ. The inventory service uses Redis `SETNX` for atomic seat locking to prevent double-booking under concurrent load.
