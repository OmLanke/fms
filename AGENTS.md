# AGENTS.md

All real work lives in `ticketflow/`. Run every `make` command from there.

---

## Quick start

```bash
cd ticketflow
make setup      # copies .env.example → .env (safe to re-run)
make dev        # builds + starts full stack in Docker
make health     # verify all services are up via gateway aggregate
make seed       # insert demo venues + events (runs inside event-service container)
```

Demo credentials after seeding: `test@ticketflow.dev` / `Test1234!`

---

## Service map

| Service | Language | Port | Database |
|---|---|---|---|
| gateway | Bun + Elysia | 3000 | — |
| user-service | Java 21 / Spring Boot 3.2 | 3001 | PostgreSQL `ticketflow_users` |
| event-service | Python 3.12 / FastAPI | 3002 | MongoDB `ticketflow_events` |
| booking-service | Java 21 / Spring Boot 3.2 | 3003 | PostgreSQL `ticketflow_bookings` |
| inventory-service | Bun + Elysia + Drizzle ORM | 3004 | PostgreSQL `ticketflow_inventory` + Redis |
| payment-service | Python 3.12 / FastAPI | 3005 | MongoDB `ticketflow_payments` |
| notification-service | Python 3.12 / FastAPI | 3006 | MongoDB `ticketflow_notifications` |
| frontend | React 18 + Vite | 5173 (dev) / 80 (prod Nginx) | — |

Dev-only UIs: Kafka UI `:8080`, Mongo Express `:8081`, Mailpit `:8025`

Observability (Grafana `:3010`, Prometheus `:9090`, Jaeger `:16686`) is **Kubernetes-only** — not present in either Docker Compose file.

---

## Makefile shortcuts worth knowing

```bash
make dev-infra              # start infra (Kafka, DBs, Redis) without app services
make restart s=<service>    # restart one service, e.g. make restart s=booking-service
make rebuild s=<service>    # rebuild image + restart
make logs-booking           # per-service log tails (logs-gateway, logs-user, logs-event, etc.)
make lint                   # bun tsc --noEmit (gateway + inventory) + py_compile (Python services)
make test                   # mvn test -q for user-service + booking-service
make kafka-consume t=<topic>
make kafka-lag g=<group>
make psql-bookings          # psql into ticketflow_bookings
make mongo-shell
make demo                   # bash scripts/demo.sh — end-to-end curl walkthrough
make k8s-apply              # deploy everything to Kubernetes
```

---

## Non-obvious architecture facts

### JWT: decoded at gateway, not verified
The gateway (`gateway/src/middleware/auth.ts`) uses `jose` `decodeJwt()` — this is **decode only, no signature verification**. It injects `x-user-id`, `x-user-email`, `x-user-role` headers. Downstream services trust these headers unconditionally. `JWT_SECRET` is only used inside `user-service` (Spring Security) and `booking-service`.

### Async booking saga (choreography)
`POST /bookings` returns **202 Accepted** with `{ bookingId }`. Client must poll `GET /bookings/:id` until `status !== "PENDING"`. The full flow:

```
booking-service → booking.initiated → inventory-service (Redis SETNX lock)
                                     → seats.locked → booking-service
                                                     → payment.requested → payment-service
                                                                         → payment.processed → booking-service
                                                                                             → booking.confirmed + seats.confirm → inventory-service (RESERVED)
                                                                                               (or booking.failed + seats.release)
```

Kafka message key = `bookingId` — guarantees ordering per booking on a single partition.

### Error response envelope
All services return: `{ "error": { "code": "SCREAMING_SNAKE", "message": "Human readable" } }`

### Kafka event envelope
All Kafka messages: `{ "eventType": "string", ...domainFields, "timestamp": "ISO8601" }`

---

## Gotchas

**Kafka external port is 9093, not 9092.** For services running outside Docker (local dev): `KAFKA_BOOTSTRAP_SERVERS=localhost:9093`. Inside Docker it is `kafka:9092`.

**Redis has no password in dev.** `REDIS_URL=redis://redis:6379` in dev compose. In prod it is `redis://:${REDIS_PASSWORD}@redis:6379`.

**Payment is mocked.** `PAYMENT_SUCCESS_RATE=0.95` controls success probability. Set to `1.0` for deterministic success. There is no real Stripe integration wired up.

**Inventory service DB migration must be run explicitly.** On first local run outside Docker: `bun src/db/migrate.ts` from `services/inventory-service/`.

**Production compose file is `docker-compose.yml`**, not `docker-compose.prod.yml` (the README's directory tree mislabels it — trust the file on disk).

**`JWT_EXPIRATION` in user-service is milliseconds** (`604800000` = 7 days). The `.env.example` also documents `JWT_EXPIRY_HOURS` but that variable is not consumed by the compose files — only `JWT_EXPIRATION` (ms) is passed to the container.

**`make dev-clean` deletes all volumes.** Data is lost. Requires re-running `make seed`.

**No CI exists.** There is no `.github/` directory. No pre-commit hooks.

---

## Kafka topics

Convention: `ticketflow.<domain>.<event>` (lowercase, dots)

Main topics (3 partitions, 7-day retention):
`ticketflow.user.registered`, `ticketflow.event.created`, `ticketflow.booking.initiated`, `ticketflow.seats.locked`, `ticketflow.seats.lock-failed`, `ticketflow.seats.confirm`, `ticketflow.seats.release`, `ticketflow.payment.requested`, `ticketflow.payment.processed`, `ticketflow.booking.confirmed`, `ticketflow.booking.failed`, `ticketflow.booking.cancelled`

DLTs (1 partition, 30-day retention):
`ticketflow.booking.initiated.DLT`, `ticketflow.payment.requested.DLT`, `ticketflow.booking.confirmed.DLT`, `ticketflow.booking.failed.DLT`

In dev `KAFKA_AUTO_CREATE_TOPICS_ENABLE=true`. In prod it is `false` — `kafka-init` creates all topics via `infra/kafka/create-topics.sh` on startup.

---

## Python service conventions

- ODM: **Beanie** (wraps Motor) for all MongoDB models
- Kafka client: **aiokafka**
- Email: **aiosmtplib** + **Jinja2** templates in `app/mailer/templates/`
- Start command (all three): `uvicorn app.main:app --host 0.0.0.0 --port <port>`

## Java service conventions

- Build: Maven (`pom.xml` at each service root); `mvn spring-boot:run` or fat jar
- JDK 21, Spring Boot 3.2.5, Lombok, jjwt 0.12.5, Spring Data JPA + Flyway
- No shared parent POM — each service has its own

## Bun/TypeScript conventions (gateway + inventory-service)

- No lockfiles committed — run `bun install` first
- Inventory uses **Drizzle ORM** with explicit migration step (`bun src/db/migrate.ts`)
- Gateway proxies all `/api/<service>/*` paths; the routing table is in `gateway/src/proxy.ts`
