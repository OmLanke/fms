# Development Guide

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Infrastructure Services](#infrastructure-services)
- [Running Individual Services Locally](#running-individual-services-locally)
- [Seeding Data](#seeding-data)
- [End-to-End Booking Walkthrough](#end-to-end-booking-walkthrough)
- [Viewing Emails in Mailpit](#viewing-emails-in-mailpit)
- [Viewing Kafka Messages](#viewing-kafka-messages)
- [Hot Reload](#hot-reload)
- [Running Tests](#running-tests)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Minimum Version | Check | Install |
|---|---|---|---|
| Docker | 24.x | `docker --version` | [docs.docker.com](https://docs.docker.com/get-docker/) |
| Docker Compose | 2.x | `docker compose version` | Bundled with Docker Desktop |
| Make | 3.x | `make --version` | `brew install make` |
| Bun | 1.1+ | `bun --version` | `curl -fsSL https://bun.sh/install \| bash` |
| JDK | 21 | `java --version` | `sdk install java 21-graalce` (SDKMAN) |
| Python | 3.12 | `python3 --version` | `pyenv install 3.12` |
| Maven | 3.9+ | `mvn --version` | `brew install maven` |

> For Docker Compose development you only need Docker + Make. Language runtimes are required only for running services outside containers.

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-org/ticketflow.git
cd ticketflow
```

### 2. Set up environment variables

```bash
make setup
# Equivalent to: cp .env.example .env
```

Review `.env` and update any values you want to customise. Defaults work for local development without changes.

### 3. Start the full stack

```bash
make dev
```

This runs `docker compose up --build` and waits for all health checks to pass. First run downloads ~2 GB of images and may take 3–5 minutes. Subsequent runs start in under 30 seconds.

### 4. Verify all services are healthy

```bash
make health
```

### 5. Seed sample data

```bash
make seed
```

Creates:
- 2 venues
- 4 events with seat maps
- 1 test user (`test@ticketflow.dev` / `Test1234!`)

---

## Infrastructure Services

When `make dev` runs, the following infrastructure containers start alongside the application services:

| Container | Purpose | Port |
|---|---|---|
| `kafka` | Message broker | 9092 (internal), 29092 (host) |
| `zookeeper` | Kafka coordination | 2181 |
| `postgres` | Relational database | 5432 |
| `mongodb` | Document database | 27017 |
| `redis` | Seat lock cache | 6379 |
| `redpanda-console` | Kafka UI | 8080 |
| `mongo-express` | MongoDB UI | 8081 |
| `mailpit` | Email capture | 8025 (UI), 1025 (SMTP) |
| `prometheus` | Metrics scraper | 9090 |
| `grafana` | Dashboards | 3010 |
| `jaeger` | Distributed tracing | 16686 |
| `loki` | Log aggregation | 3100 |
| `promtail` | Log shipper | — |

### Stop and restart infrastructure only

```bash
# Stop everything
make down

# Start only infrastructure (no application services)
make infra

# Start application services (assumes infra is running)
make services
```

---

## Running Individual Services Locally

Run a service outside Docker when you want faster iteration or need to attach a debugger. The service connects to the Dockerised infrastructure.

### Prerequisites for local dev

Ensure infrastructure is running:

```bash
make infra
```

Export shared environment variables (or source `.env`):

```bash
export $(grep -v '^#' .env | xargs)
```

### API Gateway (Bun + Elysia)

```bash
cd gateway
bun install
bun dev
# Hot reload via Bun's built-in watcher
# Service available at http://localhost:3000
```

### User Service (Java + Spring Boot 3)

```bash
cd services/user-service
mvn spring-boot:run
# Or with a specific profile:
mvn spring-boot:run -Dspring-boot.run.profiles=local
# Service available at http://localhost:3001
```

To enable the Spring Boot DevTools live-reload:

```bash
mvn spring-boot:run -Dspring-boot.run.jvmArguments="-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=n,address=5005"
```

Then attach your IDE debugger to port `5005`.

### Event Service (Python + FastAPI)

```bash
cd services/event-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 3002
# Hot reload via uvicorn --reload
# Service available at http://localhost:3002
# OpenAPI docs: http://localhost:3002/docs
```

### Booking Service (Java + Spring Boot 3)

```bash
cd services/booking-service
mvn spring-boot:run
# Service available at http://localhost:3003
```

### Inventory Service (Bun + Elysia)

```bash
cd services/inventory-service
bun install
bun dev
# Service available at http://localhost:3004
```

### Payment Service (Python + FastAPI)

```bash
cd services/payment-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 3005
# Service available at http://localhost:3005
# OpenAPI docs: http://localhost:3005/docs
```

### Notification Service (Python + FastAPI)

```bash
cd services/notification-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 3006
# Service available at http://localhost:3006
```

---

## Seeding Data

```bash
make seed
# Equivalent to: bash scripts/seed.sh
```

The seed script:
1. Registers the test user.
2. Creates two venues (Madison Square Garden, O2 Arena).
3. Creates four events with full seat maps.

To reset and re-seed:

```bash
make reset-db
make seed
```

> **Warning:** `make reset-db` drops all databases. Do not run in production.

---

## End-to-End Booking Walkthrough

The following curl sequence walks through the entire booking saga manually.

### Step 1 — Register (or use seeded test user)

```bash
curl -s -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Example",
    "email": "alice@example.com",
    "password": "Alice1234!"
  }' | jq .
```

### Step 2 — Login and capture token

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "Alice1234!"}' \
  | jq -r '.token')
echo "Token: $TOKEN"
```

### Step 3 — List events

```bash
curl -s http://localhost:3000/api/events | jq '.[] | {id, name, date}'
```

Note an event ID from the output, e.g. `EVENT_ID=evt_01HX...`.

### Step 4 — Check seat availability

```bash
curl -s http://localhost:3000/api/inventory/events/$EVENT_ID/seats \
  | jq '[.[] | select(.status == "AVAILABLE")] | .[0:5]'
```

Note 2–3 seat IDs.

### Step 5 — Create a booking (202 Accepted)

```bash
BOOKING_RESPONSE=$(curl -s -X POST http://localhost:3000/api/bookings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"eventId\": \"$EVENT_ID\",
    \"seatIds\": [\"seat_01\", \"seat_02\"],
    \"paymentMethod\": {
      \"type\": \"card\",
      \"token\": \"tok_visa\"
    }
  }")
echo $BOOKING_RESPONSE | jq .
BOOKING_ID=$(echo $BOOKING_RESPONSE | jq -r '.bookingId')
```

The response is `202 Accepted` with a `bookingId`. The saga is now running asynchronously.

### Step 6 — Poll for booking status

```bash
# Poll every 2 seconds until status is CONFIRMED or FAILED
for i in {1..15}; do
  STATUS=$(curl -s http://localhost:3000/api/bookings/$BOOKING_ID \
    -H "Authorization: Bearer $TOKEN" | jq -r '.status')
  echo "Attempt $i: $STATUS"
  [ "$STATUS" = "CONFIRMED" ] || [ "$STATUS" = "FAILED" ] && break
  sleep 2
done
```

### Step 7 — Verify email in Mailpit

Open http://localhost:8025 in your browser. You should see a booking confirmation email.

---

## Viewing Emails in Mailpit

Mailpit is a local SMTP server and web UI that captures all outbound email sent by the Notification Service.

- **URL:** http://localhost:8025
- All email sent during local development is captured here.
- No real email is sent; Mailpit acts as a sink.
- Use the web UI to inspect HTML/text bodies, headers, and attachments.

To reset the Mailpit inbox:

```bash
curl -s -X DELETE http://localhost:8025/api/v1/messages
```

---

## Viewing Kafka Messages

### Redpanda Console (recommended)

Open http://localhost:8080 in your browser.

- **Topics** tab — browse all topics, view messages, offsets, partition distribution.
- **Consumer Groups** tab — view consumer lag per group per partition. High lag indicates a slow or stopped consumer.
- **Schema Registry** tab — not used (schemas are documented in `docs/event-catalog.md`).

### CLI (kafkacat / kcat)

```bash
# List topics
docker exec -it ticketflow-kafka-1 kafka-topics.sh \
  --bootstrap-server localhost:9092 --list

# Consume the booking topic from the beginning
docker exec -it ticketflow-kafka-1 kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic ticketflow.booking.initiated \
  --from-beginning \
  --property print.key=true
```

---

## Hot Reload

| Service | Hot Reload | Mechanism |
|---|---|---|
| API Gateway | Yes | Bun built-in `--watch` |
| User Service | Partial | Spring Boot DevTools (class reload, no full restart) |
| Event Service | Yes | `uvicorn --reload` watches `app/` directory |
| Booking Service | Partial | Spring Boot DevTools |
| Inventory Service | Yes | Bun built-in `--watch` |
| Payment Service | Yes | `uvicorn --reload` |
| Notification Service | Yes | `uvicorn --reload` |
| Frontend | Yes | Vite HMR |

When running in Docker Compose (via `make dev`), the source directories are bind-mounted into containers where supported, so hot reload works without rebuilding images.

---

## Running Tests

```bash
# All tests (runs in Docker to match CI)
make test

# Unit tests for a specific service
cd services/booking-service && mvn test
cd services/event-service && pytest
cd gateway && bun test

# Integration tests (requires running infra)
make test-integration
```

---

## Troubleshooting

### Kafka consumer is not processing messages

1. Check consumer group lag in Redpanda Console at http://localhost:8080.
2. Check the service logs: `docker compose logs -f booking-service`.
3. Ensure the topic exists: browse Topics in Redpanda Console.
4. Check if the consumer crashed due to a deserialization error — look for `DeserializationException` in logs.

### Seats not locking (inventory service errors)

1. Check Redis is healthy: `docker compose ps redis`.
2. Check Redis connectivity from inventory service:
   ```bash
   docker exec -it ticketflow-inventory-service-1 sh -c 'redis-cli -h redis ping'
   ```
3. Check for stale locks from a previous crashed saga:
   ```bash
   docker exec -it ticketflow-redis-1 redis-cli KEYS "seat:*"
   ```
   Delete stale keys: `docker exec -it ticketflow-redis-1 redis-cli DEL seat:evt_01:A1`

### Booking stays in PENDING indefinitely

1. Open Redpanda Console and check the `ticketflow.booking.initiated` topic for the booking's message.
2. Check Inventory Service logs for errors processing that message.
3. Check the DLT topic `ticketflow.booking.initiated.DLT` for failed messages.

### Payment service not receiving messages

1. Confirm the Booking Service produced a `ticketflow.payment.requested` message in Redpanda Console.
2. Check the `payment-service` consumer group lag.
3. Verify `STRIPE_SECRET_KEY` is set in `.env`.

### Database migration failed

```bash
# Re-run PostgreSQL migrations
docker exec -it ticketflow-user-service-1 sh -c 'java -jar app.jar --spring.flyway.repair=true'

# Re-run MongoDB index creation
docker exec -it ticketflow-mongodb-1 mongosh --eval "load('/docker-entrypoint-initdb.d/init.js')"
```

### Port conflict

If port 3000 or another port is already in use:

```bash
# Find what is using port 3000
lsof -i :3000

# Change the port in .env and docker-compose.yml
```

### Docker Compose build fails

```bash
# Clear build cache and rebuild
docker compose down -v
docker builder prune -f
make dev
```
