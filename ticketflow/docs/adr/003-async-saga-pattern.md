# ADR 003 — Async Choreography Saga for Booking Flow

**Status:** Accepted  
**Date:** 2024-02-20  
**Deciders:** Platform Architecture Team

---

## Context

The original booking flow was **synchronous HTTP**: the gateway called booking-service, which called inventory-service, then payment-service, then notification-service in a chain. Each call was blocking; if any downstream service timed out, the entire booking failed with a 500 error to the client.

Problems observed:

1. **Cascading failures** — A spike in payment-service latency caused gateway timeouts, which caused retry storms, which caused further payment-service overload.
2. **Tight coupling** — Booking-service needed to know the URLs, request/response contracts, and error modes of inventory-service and payment-service.
3. **No partial recovery** — If payment-service succeeded but notification-service was down, the booking was marked as failed and seats were incorrectly released.
4. **Scaling constraint** — All services in the chain had to scale together; if payment-service was slow, it blocked all booking-service threads waiting for a response.
5. **No audit trail** — The sequence of events for a booking existed only in service logs, making post-incident analysis difficult.

We evaluated two saga approaches:

- **Orchestration** — A dedicated "booking orchestrator" service sends commands to each participant and tracks the saga state.
- **Choreography** — Each service reacts to events published by other services; there is no central coordinator.

---

## Decision

Implement the booking lifecycle as a **fully asynchronous choreography saga** via Apache Kafka. The gateway returns `202 Accepted` immediately; the client polls for the result.

---

## Rationale

### Choreography vs Orchestration

| Dimension | Orchestration | Choreography |
|---|---|---|
| Central coordinator | Yes (orchestrator service) | No |
| Single point of failure | Yes (if orchestrator fails) | No |
| Service coupling | Services coupled to orchestrator | Services coupled only to Kafka schemas |
| Debugging | Easier (state in orchestrator) | Harder (state distributed across services) |
| Adding new participants | Orchestrator must be updated | New service subscribes to relevant topics |
| Scalability | Orchestrator may become bottleneck | Each participant scales independently |

For TicketFlow's scale and the team's familiarity with event-driven patterns, choreography provides better resilience at the cost of slightly more complex debugging (mitigated by distributed tracing).

### Why fully async (202 pattern)?

The booking saga involves three external interactions: Redis lock, Stripe payment, SMTP send. End-to-end this can take 500ms–3s depending on Stripe latency. Holding an HTTP connection open for this duration:

- Blocks gateway threads unnecessarily.
- Provides no resilience benefit (if the client disconnects, the saga still needs to complete).
- Requires synchronous propagation of every failure mode back to the client.

With `202 Accepted` + polling:
- The gateway thread is free immediately after the Booking Service acknowledges.
- The saga runs to completion regardless of client connectivity.
- The client gets a clean polling interface: `GET /api/bookings/:id` returns the current status.

### Compensating transactions

Each saga step has a defined compensating action in the failure path. This is the key invariant of the saga pattern: if a step cannot complete, all prior steps must be undone.

| Step | Compensation |
|---|---|
| Seats locked | Release seats (`seats.release`) |
| Payment processed | Issue refund (future work; currently payment attempted only after successful lock) |

---

## Tradeoffs

### Eventual consistency

The booking record does not immediately reflect its final status. Between `202 Accepted` and `CONFIRMED` or `FAILED`, the booking is in `PENDING`. Clients must tolerate this window (typically < 5 seconds).

This is acceptable for a ticketing platform: the user submits a booking and is told to wait for confirmation, which is standard UX for payment flows.

### More complex client

The frontend must implement a polling loop (or WebSocket subscription) rather than a simple request/response. The frontend polls `GET /api/bookings/:id` every 2 seconds with a 60-second timeout.

### Harder to debug without tooling

When a saga stalls, there is no single service with a complete state machine to inspect. Investigation requires:

1. Checking the booking record in the Booking Service DB.
2. Checking consumer group lag in Redpanda Console.
3. Checking service logs in Loki.
4. Following the distributed trace in Jaeger.

This is why the observability stack (Prometheus, Grafana, Jaeger, Loki) is non-optional infrastructure for TicketFlow.

### No global transaction

There is no way to atomically commit state across Booking Service (PostgreSQL) and Inventory Service (PostgreSQL + Redis). The saga pattern accepts this and provides compensating transactions as the recovery mechanism.

---

## Consequences

### Positive

- No single point of failure in the booking flow.
- Each service (Inventory, Payment, Notification) scales independently based on its Kafka consumer lag.
- A service crash during a saga does not lose the booking; it resumes when the service restarts.
- The Kafka topic is an immutable audit log of every booking step.
- Adding a new participant (e.g. a loyalty points service) requires only subscribing to `booking.confirmed` — no changes to existing services.

### Negative

- Client must poll for final status.
- Eventual consistency window exists between saga start and completion.
- Debugging requires cross-service tooling (Jaeger + Loki + Kafka UI).
- Idempotency must be implemented in every consumer.
