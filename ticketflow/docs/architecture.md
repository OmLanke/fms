# Architecture Deep-Dive

## Table of Contents

- [System Overview](#system-overview)
- [Design Principles](#design-principles)
- [Service Responsibilities](#service-responsibilities)
- [Communication Patterns](#communication-patterns)
- [Choreography Saga Pattern](#choreography-saga-pattern)
- [Database Selection Rationale](#database-selection-rationale)
- [Kafka Topic Design](#kafka-topic-design)
- [Seat Locking Algorithm](#seat-locking-algorithm)
- [JWT Authentication Flow](#jwt-authentication-flow)
- [Error Handling Strategy](#error-handling-strategy)
- [Resilience Patterns](#resilience-patterns)
- [Scalability Analysis](#scalability-analysis)
- [Security Considerations](#security-considerations)

---

## System Overview

TicketFlow is composed of eight independently deployable services that communicate via two channels:

- **Synchronous HTTP** — used only from the API Gateway to individual services for direct client requests (reads, user management). The gateway is the single entry point; no service calls another service over HTTP.
- **Asynchronous Kafka** — used for all inter-service coordination, including the booking saga, notifications, and inventory management.

This strict separation means each service is unaware of the existence of other services at the network level. Coupling is limited to shared Kafka topic schemas (defined in `docs/event-catalog.md`).

---

## Design Principles

### 1. Database Per Service

Every service owns exactly one datastore. No two services share a database schema, a connection pool, or a set of tables. This enforces:

- **Independent schema evolution** — a service can migrate its schema without coordination.
- **Technology fit** — relational data goes to PostgreSQL; document data goes to MongoDB.
- **Fault isolation** — a MongoDB outage affects only the services that use it.

### 2. Single Responsibility

Each service does one thing:

| Service | Single Responsibility |
|---|---|
| API Gateway | Authenticate requests and proxy to downstream services |
| User Service | Manage user identities and credentials |
| Event Service | Manage event and venue data |
| Booking Service | Coordinate the booking lifecycle |
| Inventory Service | Manage seat state and locks |
| Payment Service | Process and record payments |
| Notification Service | Deliver email notifications |

### 3. Event-Driven by Default

Services publish events to Kafka when their state changes. Other services react to those events. No service invokes another service's internal logic; the only contract is the event payload schema.

### 4. Idempotent Consumers

Every Kafka consumer is designed to process the same message multiple times without side effects. This is achieved via:

- Unique constraint checks before DB writes.
- Redis `SET NX` for distributed locks.
- Idempotency keys on payment records.

---

## Service Responsibilities

| Service | Runtime | Owns | Produces | Consumes |
|---|---|---|---|---|
| API Gateway | Bun + Elysia | — | — | — |
| User Service | Spring Boot 3 | `users` table | `user.registered` | — |
| Event Service | FastAPI | `events`, `venues` collections | `event.created` | — |
| Booking Service | Spring Boot 3 | `bookings` table | `booking.initiated`, `payment.requested`, `booking.confirmed`, `booking.failed`, `seats.confirm`, `seats.release` | `seats.locked`, `seats.lock-failed`, `payment.processed` |
| Inventory Service | Bun + Elysia | `seats` table, Redis keys | `seats.locked`, `seats.lock-failed` | `booking.initiated`, `seats.confirm`, `seats.release`, `booking.cancelled` |
| Payment Service | FastAPI | `payments` collection | `payment.processed` | `payment.requested` |
| Notification Service | FastAPI | `notifications` collection | — | `booking.confirmed`, `booking.failed`, `booking.cancelled`, `user.registered` |

---

## Communication Patterns

### Synchronous (HTTP)

Used only for client-facing requests where immediate data is needed:

```
Client → Gateway → Service (HTTP/1.1 or HTTP/2)
```

All HTTP communication is internal to the Docker/Kubernetes network except the gateway's public port. Services do not expose ports directly.

Gateway routing rules:

| Path Prefix | Target Service |
|---|---|
| `/api/users/*` | `user-service:3001` |
| `/api/events/*` | `event-service:3002` |
| `/api/bookings/*` | `booking-service:3003` |
| `/api/inventory/*` | `inventory-service:3004` |
| `/api/payments/*` | `payment-service:3005` |
| `/api/notifications/*` | `notification-service:3006` |

### Asynchronous (Kafka)

Used for all inter-service state propagation. The pattern is:

1. A service completes a local transaction and commits to its own database.
2. The service produces a Kafka event in the same transaction (transactional outbox pattern).
3. Downstream services consume the event and react.

This guarantees that a service never publishes an event about a state change that was rolled back.

---

## Choreography Saga Pattern

### Why Choreography over Orchestration?

An orchestrator is a single service that tells every other service what to do next. It becomes a central point of failure and a deployment bottleneck. In choreography, each service knows only its own role and reacts to events it cares about — there is no coordinator.

### Booking Saga Steps

| Step | Event In | Actor | Local Action | Event Out |
|---|---|---|---|---|
| 1 | `POST /bookings` (HTTP) | Booking Service | Insert booking (PENDING) | `booking.initiated` |
| 2 | `booking.initiated` | Inventory Service | Redis SETNX per seat, update DB (LOCKED) | `seats.locked` or `seats.lock-failed` |
| 3a | `seats.locked` | Booking Service | No state change | `payment.requested` |
| 3b | `seats.lock-failed` | Booking Service | Update booking (FAILED) | `booking.failed` |
| 4 | `payment.requested` | Payment Service | Charge card, insert payment record | `payment.processed` (SUCCESS or FAILED) |
| 5a | `payment.processed` (SUCCESS) | Booking Service | Update booking (CONFIRMED) | `booking.confirmed`, `seats.confirm` |
| 5b | `payment.processed` (FAILED) | Booking Service | Update booking (FAILED) | `booking.failed`, `seats.release` |
| 6 | `seats.confirm` | Inventory Service | Update seats (RESERVED), delete Redis keys | — |
| 7 | `seats.release` | Inventory Service | Update seats (AVAILABLE), delete Redis keys | — |
| 8 | `booking.confirmed` | Notification Service | Send email, insert notification log | — |
| 9 | `booking.failed` | Notification Service | Send failure email | — |

### Compensating Transactions

| Failed Step | Compensation |
|---|---|
| Seat lock fails | Booking set FAILED, no payment attempted |
| Payment fails | `seats.release` sent, seats returned to AVAILABLE |
| Notification fails | Retry with exponential backoff; dead-letter after 5 attempts |
| Inventory Service down during confirm | Message sits in Kafka; processed when service recovers |

---

## Database Selection Rationale

| Service | Database | Why |
|---|---|---|
| User Service | PostgreSQL | Users require ACID transactions (unique email, atomic credential updates). Relational integrity is valuable for user-role associations. |
| Booking Service | PostgreSQL | Bookings are financial records. ACID is non-negotiable. Strong consistency for the booking state machine. |
| Inventory Service | PostgreSQL + Redis | PostgreSQL for durable seat records. Redis for fast distributed TTL-based seat locks (SETNX). |
| Event Service | MongoDB | Events have flexible, nested schemas (seat maps, metadata, ticket tiers). Document model fits naturally; no relations needed. |
| Payment Service | MongoDB | Payment records are append-only and schema-flexible (different payment provider response shapes). |
| Notification Service | MongoDB | Notification logs are append-only documents. Query patterns are simple (find recent by user). |

---

## Kafka Topic Design

### Naming Convention

```
ticketflow.<domain>.<event-type>
```

- `ticketflow` — platform namespace (allows multi-tenant broker sharing)
- `<domain>` — the bounded context (`user`, `event`, `booking`, `seats`, `payment`)
- `<event-type>` — past-tense verb describing what happened

### Partition Strategy

| Topic | Partitions | Partition Key | Rationale |
|---|---|---|---|
| `ticketflow.booking.initiated` | 6 | `bookingId` | Ensures ordered processing per booking |
| `ticketflow.seats.locked` | 6 | `bookingId` | Same booking must process in order |
| `ticketflow.payment.requested` | 6 | `bookingId` | Idempotent payment per booking |
| `ticketflow.payment.processed` | 6 | `bookingId` | Correlate back to booking |
| `ticketflow.booking.confirmed` | 3 | `userId` | Fan-out to notification, balanced |
| `ticketflow.user.registered` | 3 | `userId` | Low volume, user-scoped |
| `ticketflow.event.created` | 3 | `eventId` | Low volume |

### Retention Policy

- **Saga topics** (`booking.*`, `seats.*`, `payment.*`): 7-day retention, compaction disabled. Enables replay of recent saga steps.
- **Notification topics** (`user.registered`, `booking.confirmed`): 3-day retention. Notifications are best-effort.
- **Dead-letter topics** (`*.DLT`): 30-day retention for incident investigation.

### Consumer Groups

| Group ID | Topics Consumed |
|---|---|
| `inventory-service` | `booking.initiated`, `seats.confirm`, `seats.release`, `booking.cancelled` |
| `payment-service` | `payment.requested` |
| `booking-service` | `seats.locked`, `seats.lock-failed`, `payment.processed` |
| `notification-service` | `booking.confirmed`, `booking.failed`, `booking.cancelled`, `user.registered` |

---

## Seat Locking Algorithm

Seat locking prevents double-booking under concurrent load. The algorithm runs in the Inventory Service.

### Step 1 — Acquire Locks (Redis SETNX)

For each requested seat:

```
SET seat:{eventId}:{seatId} {bookingId} NX PX 300000
```

- `NX` — only set if the key does not exist (atomic).
- `PX 300000` — TTL of 5 minutes; locks expire if the saga does not complete.

If **all** seats are locked successfully → publish `seats.locked`.

If **any** seat fails to lock (key already exists) → roll back already-acquired locks:

```
DEL seat:{eventId}:{seatId}   # for each already-locked seat
```

Then publish `seats.lock-failed` with the conflicting seat IDs.

### Step 2 — Confirm Locks (on `seats.confirm`)

```sql
UPDATE seats SET status = 'RESERVED', booking_id = ? WHERE id = ? AND status = 'LOCKED'
```

Then delete Redis keys:

```
DEL seat:{eventId}:{seatId}
```

### Step 3 — Release Locks (on `seats.release` or TTL expiry)

```sql
UPDATE seats SET status = 'AVAILABLE', booking_id = NULL WHERE id = ? AND booking_id = ?
```

Redis keys are either explicitly deleted or expire via TTL.

### Idempotency

The lock acquisition checks the Redis key value against the `bookingId`. If the same `bookingId` attempts to lock a seat it already holds (message replay), the operation succeeds without duplication.

---

## JWT Authentication Flow

```
Client                    Gateway                   User Service
  │                          │                           │
  │  POST /api/users/login    │                           │
  │ ─────────────────────────>│                           │
  │                          │  POST /internal/auth       │
  │                          │ ──────────────────────────>│
  │                          │           JWT token        │
  │                          │ <──────────────────────────│
  │        {token: "..."}    │                           │
  │ <─────────────────────────│                           │
  │                          │                           │
  │  GET /api/bookings/my     │                           │
  │  Authorization: Bearer …  │                           │
  │ ─────────────────────────>│                           │
  │                          │ Verify JWT locally         │
  │                          │ Inject X-User-Id header    │
  │                          │ ─────────────────────────> Booking Service
  │                          │                           │
```

Key points:

1. The gateway holds the `JWT_SECRET` and verifies tokens locally — no round-trip to the User Service on every request.
2. On successful verification the gateway injects `X-User-Id` and `X-User-Role` headers before forwarding.
3. Downstream services trust these headers (they are not exposed externally).
4. Token expiry is enforced by the gateway; expired tokens receive `401 Unauthorized` before the request reaches any service.

---

## Error Handling Strategy

### HTTP Errors

The gateway normalises all upstream errors to a consistent shape:

```json
{
  "error": {
    "code": "BOOKING_NOT_FOUND",
    "message": "Booking abc123 does not exist",
    "requestId": "req_01HX..."
  }
}
```

HTTP status codes follow RFC 7807 semantics: `400` for client errors, `404` for not-found, `409` for conflicts, `500` for upstream failures.

### Kafka Consumer Errors

1. **Transient errors** (DB unavailable, Redis timeout): message is not acknowledged; Kafka re-delivers after the consumer's `max.poll.interval.ms`.
2. **Permanent errors** (schema violation, corrupt payload): after 3 retries with exponential backoff the message is forwarded to the Dead-Letter Topic (`*.DLT`).
3. **DLT monitoring**: Grafana alert fires when any DLT partition has messages. On-call engineer investigates and replays or discards.

---

## Resilience Patterns

| Pattern | Where Applied | Implementation |
|---|---|---|
| Retry with backoff | All Kafka consumers | Spring Retry / tenacity (Python) |
| Dead-letter topic | All Kafka consumers | Spring Kafka `DeadLetterPublishingRecoverer` |
| Circuit breaker | Gateway → downstream HTTP | Elysia middleware with half-open state |
| Idempotency keys | Payment Service | MongoDB unique index on `idempotencyKey` |
| TTL-based lock expiry | Inventory Service | Redis key TTL (5 minutes) |
| Transactional outbox | Booking Service | Spring `@Transactional` wrapping DB write + Kafka publish |
| Health checks | All services | `/health` or `/actuator/health` endpoints |
| Graceful shutdown | All services | SIGTERM → drain in-flight requests → close Kafka consumer |

---

## Scalability Analysis

| Service | Scaling Dimension | Bottleneck | KEDA Trigger |
|---|---|---|---|
| API Gateway | Request rate | CPU / connections | HTTP RPS (custom metric) |
| User Service | Login throughput | DB connection pool | CPU utilisation |
| Event Service | Read throughput | MongoDB read IOPS | HTTP RPS |
| Booking Service | Saga throughput | Kafka consumer lag | `ticketflow.booking.initiated` lag |
| Inventory Service | Lock throughput | Redis ops/sec | `ticketflow.booking.initiated` lag |
| Payment Service | Payment throughput | External API rate limits | `ticketflow.payment.requested` lag |
| Notification Service | Email throughput | SMTP rate limits | `ticketflow.booking.confirmed` lag |

Inventory Service and Payment Service are the primary bottlenecks in the booking saga. KEDA monitors consumer group lag and adds pods when lag exceeds 50 messages per partition.

---

## Security Considerations

| Concern | Mitigation |
|---|---|
| JWT secret exposure | Secret stored in Kubernetes Secret, injected as env var, never logged |
| SQL injection | Parameterised queries via JPA / psycopg3 |
| MongoDB injection | Pydantic model validation before any DB operation |
| Kafka topic access | SASL/SCRAM authentication in production; ACLs per consumer group |
| Secrets in Docker Compose | `.env` excluded from git via `.gitignore`; `.env.example` has no real values |
| Stripe webhook verification | Signature verified using `STRIPE_WEBHOOK_SECRET` before processing |
| Cross-service trust | `X-User-Id` header only injected by the gateway; services behind internal network |
| Rate limiting | Gateway enforces per-IP rate limits on public endpoints |
| TLS | All traffic encrypted in production via NGINX TLS termination or Kubernetes Ingress with cert-manager |
