# Inventory Service

## Responsibility

The Inventory Service is the authority on seat availability. It:

- Serves real-time seat availability queries (high read throughput).
- Implements distributed seat locking using Redis SETNX (atomic, TTL-based).
- Reacts to saga events to lock, confirm, or release seats.
- Maintains the durable seat record in PostgreSQL.

The Inventory Service is the hottest service in the platform — seat availability is queried on every event page view and during booking.

---

## Technology Stack

| Component | Technology |
|---|---|
| Runtime | Bun 1.1 |
| Framework | Elysia |
| Language | TypeScript |
| Database | PostgreSQL 16 |
| Cache / Lock | Redis 7 |
| DB Client | `postgres` (bun-native) |
| Redis Client | `ioredis` |
| Kafka | `kafkajs` |
| Metrics | `prom-client` |
| Tracing | OpenTelemetry |

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/inventory/events/:eventId/seats` | No | List all seats with status |
| GET | `/health` | No | Health check |
| GET | `/metrics` | No | Prometheus metrics |

---

## Database Schema

```sql
-- init.sql
CREATE TABLE seats (
    id          VARCHAR(26) PRIMARY KEY,
    event_id    VARCHAR(26) NOT NULL,
    row_label   VARCHAR(10) NOT NULL,
    seat_number INTEGER NOT NULL,
    tier        VARCHAR(20) NOT NULL,
    price       INTEGER NOT NULL,      -- minor currency units
    currency    VARCHAR(3) NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    booking_id  VARCHAR(26),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, row_label, seat_number)
);

CREATE INDEX idx_seats_event_status ON seats(event_id, status);
CREATE INDEX idx_seats_booking_id ON seats(booking_id);
```

### Seat Status

| Status | Description |
|---|---|
| `AVAILABLE` | Can be booked |
| `LOCKED` | Temporarily held in Redis (max 5 min TTL) |
| `RESERVED` | Sold — booking confirmed |

---

## Kafka Topics

| Topic | Direction | When |
|---|---|---|
| `ticketflow.seats.locked` | **Produced** | All requested seats successfully locked |
| `ticketflow.seats.lock-failed` | **Produced** | One or more seats unavailable |
| `ticketflow.booking.initiated` | **Consumed** | Attempt to lock seats |
| `ticketflow.seats.confirm` | **Consumed** | Move seats LOCKED → RESERVED |
| `ticketflow.seats.release` | **Consumed** | Move seats LOCKED → AVAILABLE |
| `ticketflow.booking.cancelled` | **Consumed** | Move seats RESERVED → AVAILABLE |

---

## Key Algorithms

### Distributed Seat Lock (Redis SETNX)

```typescript
async function lockSeats(bookingId: string, eventId: string, seatIds: string[]): Promise<LockResult> {
  const locked: string[] = [];
  const TTL_MS = 5 * 60 * 1000; // 5 minutes

  for (const seatId of seatIds) {
    const key = `seat:${eventId}:${seatId}`;
    const result = await redis.set(key, bookingId, 'NX', 'PX', TTL_MS);
    if (result === 'OK') {
      locked.push(seatId);
    } else {
      // Check if this booking already owns the lock (idempotent replay)
      const existing = await redis.get(key);
      if (existing === bookingId) {
        locked.push(seatId);
      } else {
        // Rollback: release all locks acquired in this attempt
        for (const lockedSeatId of locked) {
          await redis.del(`seat:${eventId}:${lockedSeatId}`);
        }
        return { success: false, unavailableSeatIds: [seatId] };
      }
    }
  }

  // Persist LOCKED status to PostgreSQL
  await sql`
    UPDATE seats
    SET status = 'LOCKED', booking_id = ${bookingId}, updated_at = NOW()
    WHERE id = ANY(${seatIds})
      AND event_id = ${eventId}
      AND status = 'AVAILABLE'
  `;

  return { success: true, lockedSeatIds: locked };
}
```

### Confirm Seats

```typescript
async function confirmSeats(bookingId: string, eventId: string, seatIds: string[]) {
  // Atomic DB update
  await sql`
    UPDATE seats
    SET status = 'RESERVED', updated_at = NOW()
    WHERE id = ANY(${seatIds})
      AND booking_id = ${bookingId}
      AND status = 'LOCKED'
  `;
  // Delete Redis locks
  const keys = seatIds.map(id => `seat:${eventId}:${id}`);
  await redis.del(...keys);
}
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Listening port | `3004` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://ticketflow:pass@postgres:5432/ticketflow` |
| `REDIS_URL` | Redis connection string | `redis://:pass@redis:6379` |
| `KAFKA_BOOTSTRAP_SERVERS` | Kafka broker | `kafka:9092` |
| `SEAT_LOCK_TTL_MS` | Redis lock TTL in ms | `300000` |

---

## Local Development

```bash
cd services/inventory-service
bun install
bun dev
# Service available at http://localhost:3004
```

---

## Docker Build

```dockerfile
FROM oven/bun:1.1-alpine AS builder
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY src/ ./src/
RUN bun build src/index.ts --outdir dist --target bun

FROM oven/bun:1.1-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3004
CMD ["bun", "dist/index.js"]
```
