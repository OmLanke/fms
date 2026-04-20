# ADR 004 — Database Per Service

**Status:** Accepted  
**Date:** 2024-01-20  
**Deciders:** Platform Architecture Team

---

## Context

The original TicketFlow monolith used a **single PostgreSQL database** shared across all domain areas. When we decomposed the monolith into microservices, the initial approach kept the single database (shared database anti-pattern) for simplicity.

This led to several problems:

1. **Schema coupling** — A migration to the `bookings` table required coordinating deployments of three services simultaneously.
2. **Technology lock-in** — Event data (flexible, nested seat maps) was forced into PostgreSQL JSONB columns rather than a native document store.
3. **Blast radius** — A slow query in the notification service's SELECT statements degraded response times for the booking service.
4. **Independent scaling impossible** — PostgreSQL connection pools were shared; a traffic spike in the event service exhausted connections for the payment service.

---

## Decision

Each microservice owns exactly one database (or database cluster). No service may connect directly to another service's database. Cross-service data access is only permitted through the service's public API or via Kafka events.

| Service | Database | Technology |
|---|---|---|
| User Service | `ticketflow_users` | PostgreSQL |
| Booking Service | `ticketflow_bookings` | PostgreSQL |
| Inventory Service | `ticketflow_inventory` | PostgreSQL + Redis |
| Event Service | `ticketflow_events` | MongoDB |
| Payment Service | `ticketflow_payments` | MongoDB |
| Notification Service | `ticketflow_notifications` | MongoDB |

---

## Rationale

### Technology fit

| Service | Why PostgreSQL | Why MongoDB |
|---|---|---|
| User Service | User records are relational (user → roles → sessions). ACID required for credential updates. | — |
| Booking Service | Bookings are financial records. ACID non-negotiable. | — |
| Inventory Service | Seat records have a fixed schema and require transactional updates. | — |
| Event Service | — | Events have flexible, nested schemas (seat maps vary per venue, metadata fields per event type). |
| Payment Service | — | Payment records are append-only documents. Provider response shapes vary (Stripe vs PayPal). |
| Notification Service | — | Notification logs are simple append-only documents. No relational queries needed. |

### Service isolation

With database-per-service:
- A MongoDB upgrade affects only Python services; PostgreSQL services are unaffected.
- The Booking Service can add a column to `bookings` without any coordination.
- A MongoDB replica set failover does not affect PostgreSQL-backed services.

### Independent scaling

Each service manages its own connection pool. The Inventory Service can have 100 Redis connections without affecting the User Service's PostgreSQL pool.

---

## Consequences

### Positive

- Services can be deployed independently without database migration coordination.
- Each service uses the database technology that best fits its access patterns.
- Failure of one datastore is isolated to the services that use it.
- Each service's schema can evolve without cross-team coordination.
- Performance isolation: heavy queries in one service do not affect others.

### Negative

- **No cross-service joins** — There is no SQL JOIN between `bookings` and `events`. Data needed for a combined view (e.g. booking confirmation email with event details) must be either fetched via API at event time or duplicated in the event payload.
- **Data duplication** — The `booking.confirmed` Kafka event carries a copy of `eventName`, `venueName`, and `eventDate` so the Notification Service does not need to query the Event Service.
- **Eventual consistency** — A user's booking list cannot be joined with real-time event data in a single query. The frontend fetches bookings, then fetches event details for each booking separately (or relies on cached data in the booking record).
- **Operational complexity** — Running PostgreSQL, MongoDB, and Redis in production requires three sets of backup procedures, monitoring dashboards, and operational runbooks.

### Mitigations

- Kafka events carry denormalised copies of the data consumers need (see `docs/event-catalog.md`).
- The `docs/architecture.md` section on database selection documents which data lives where.
- Backup and restore procedures are documented in `docs/deployment.md`.
- Grafana dashboards monitor all three datastores from a single pane.
