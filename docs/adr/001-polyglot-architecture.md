# ADR 001 — Polyglot Microservice Architecture

**Status:** Accepted  
**Date:** 2024-01-15  
**Deciders:** Platform Architecture Team

---

## Context

TicketFlow began as a monoglot Node.js/Express monolith. As the team grew and the domain expanded, we began decomposing the system into microservices. The initial decomposition kept all services on Node.js with the assumption that a single language lowers the operational burden.

Over time this assumption was challenged by several workload-specific constraints:

1. **Booking and User services** have strong transactional requirements. Node.js async I/O is well-suited to I/O-bound work, but the lack of true multithreading means CPU-bound saga coordination logic competes with the event loop. Spring Boot with JDK 21 virtual threads handles concurrent request processing and Kafka listener threads more naturally.

2. **Event and Payment services** deal with schema-flexible, document-oriented data. Python's FastAPI provides automatic OpenAPI generation and Pydantic validation which significantly reduces boilerplate for document-centric APIs. The Stripe Python SDK is also the most mature.

3. **Inventory and Gateway services** are the highest-throughput services. They proxy requests and perform Redis operations at high frequency. Bun's runtime throughput on these workloads benchmarks 30–40% higher than Node.js 20 with Fastify, at the cost of a smaller ecosystem.

The question became: is the engineering cost of maintaining multiple runtimes justified by the workload-specific gains?

---

## Decision

We adopted a **polyglot microservice architecture** with three runtimes:

| Runtime | Services |
|---|---|
| JDK 21 + Spring Boot 3 | User Service, Booking Service |
| Python 3.12 + FastAPI | Event Service, Payment Service, Notification Service |
| Bun 1.1 + Elysia | API Gateway, Inventory Service |

---

## Rationale

### Technology → Workload mapping

| Service | Primary Characteristic | Technology Strength |
|---|---|---|
| API Gateway | High-throughput proxying, JWT verification | Bun: fast startup, native fetch, low overhead |
| User Service | ACID transactions, strong typing, concurrent auth | Spring Boot: mature security, JPA, virtual threads |
| Event Service | Flexible document schema, read-heavy, OpenAPI | FastAPI: Pydantic validation, automatic docs |
| Booking Service | Saga coordinator, transactional DB writes, Kafka | Spring Kafka: exactly-once, mature retry/DLT support |
| Inventory Service | Hot path (thousands of reads/sec), Redis-heavy | Bun: tight loop performance, competitive Redis client |
| Payment Service | Provider SDK integration, webhook callbacks | FastAPI: best-in-class Stripe SDK, async background tasks |
| Notification Service | Template rendering, low-throughput, iteration speed | FastAPI: Jinja2 email templates, simple SMTP integration |

### Why not Go?

Go was evaluated for the high-throughput services (Gateway, Inventory). Go's performance is excellent, but:

- The team has no Go expertise; ramping up on Go + a gateway framework + Kafka client simultaneously carries high risk.
- Bun's TypeScript provides sufficient performance gains over Node.js for our traffic levels.
- TypeScript shared types can be used across Gateway, Inventory, and Frontend.

### Why not a single language?

- Forcing Java onto the Notification Service adds unnecessary startup time and operational weight for a low-throughput consumer.
- Forcing Python onto the Booking Service sacrifices Spring's mature transactional saga infrastructure.
- The team already has existing expertise in all three chosen runtimes.

---

## Consequences

### Positive

- Each service uses the best tool for its job, reducing incidental complexity.
- Independent deployment pipelines per language (Maven for Java, pip/uv for Python, Bun for TypeScript).
- Failure in one runtime does not cascade across runtimes.
- Strong typing in Java and TypeScript catches schema contract violations at compile time.

### Negative

- **CI/CD complexity** — three separate build pipelines, three sets of linters, three testing frameworks.
- **Developer onboarding** — new engineers must be comfortable with at least two runtimes.
- **Shared code** — no shared libraries across runtimes; event payload schemas must be kept in sync manually (see `docs/event-catalog.md`).
- **Operational tooling** — JVM memory tuning, Python GIL considerations, and Bun runtime differences each require separate expertise.

### Mitigations

- Developer documentation (`docs/development.md`) provides per-service setup instructions.
- The event catalog is the single source of truth for Kafka payload contracts.
- `make lint` and `make test` run all language-specific checks from a single entry point.
