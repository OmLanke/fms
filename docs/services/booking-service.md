# Booking Service

## Responsibility

The Booking Service is the choreography saga coordinator for the booking lifecycle. It:

- Accepts booking requests from the gateway and creates a `PENDING` booking record.
- Drives the saga forward by producing Kafka events at each step.
- Reacts to events from Inventory Service and Payment Service to advance or abort the saga.
- Provides the booking status polling endpoint.
- Handles booking cancellation.

The Booking Service has the most complex Kafka logic: it both produces and consumes multiple topics.

---

## Technology Stack

| Component | Technology |
|---|---|
| Runtime | JDK 21 |
| Framework | Spring Boot 3.3 |
| Language | Java |
| Database | PostgreSQL 16 |
| ORM | Spring Data JPA |
| Migrations | Flyway |
| Kafka | Spring Kafka (producer + consumer) |
| Metrics | Micrometer → Prometheus |
| Tracing | OpenTelemetry Java Agent |

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/bookings` | Yes (X-User-Id) | Initiate booking (202) |
| GET | `/bookings/my` | Yes | List user's bookings |
| GET | `/bookings/{id}` | Yes | Get booking status |
| POST | `/bookings/{id}/cancel` | Yes | Cancel booking |
| GET | `/actuator/health` | No | Health check |
| GET | `/actuator/prometheus` | No | Prometheus metrics |

---

## Database Schema

```sql
-- V1__create_bookings.sql
CREATE TABLE bookings (
    id                  VARCHAR(26) PRIMARY KEY,
    user_id             VARCHAR(26) NOT NULL,
    event_id            VARCHAR(26) NOT NULL,
    seat_ids            TEXT[] NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    total_amount        INTEGER NOT NULL,
    currency            VARCHAR(3) NOT NULL,
    payment_method_token VARCHAR(255) NOT NULL,
    idempotency_key     VARCHAR(36) NOT NULL UNIQUE,
    payment_id          VARCHAR(26),
    failure_reason      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at        TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ
);

CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_event_id ON bookings(event_id);
```

### Booking Status State Machine

```
PENDING → [seats.locked]  → (produce payment.requested)
PENDING → [seats.lock-failed] → FAILED
PENDING/PAYMENT_PENDING → [payment.processed SUCCESS] → CONFIRMED
PENDING/PAYMENT_PENDING → [payment.processed FAILED] → FAILED
CONFIRMED → [cancel request] → CANCELLED
```

---

## Kafka Topics

| Topic | Direction | When |
|---|---|---|
| `ticketflow.booking.initiated` | **Produced** | After inserting PENDING booking |
| `ticketflow.payment.requested` | **Produced** | After receiving `seats.locked` |
| `ticketflow.booking.confirmed` | **Produced** | After payment SUCCESS |
| `ticketflow.booking.failed` | **Produced** | After payment FAILED or seat lock failed |
| `ticketflow.seats.confirm` | **Produced** | After payment SUCCESS |
| `ticketflow.seats.release` | **Produced** | After payment FAILED or cancellation |
| `ticketflow.booking.cancelled` | **Produced** | After cancellation |
| `ticketflow.seats.locked` | **Consumed** | Advance saga to payment step |
| `ticketflow.seats.lock-failed` | **Consumed** | Abort saga |
| `ticketflow.payment.processed` | **Consumed** | Confirm or fail booking |

### Consumer configuration

```java
@KafkaListener(
    topics = "ticketflow.seats.locked",
    groupId = "booking-service",
    containerFactory = "kafkaListenerContainerFactory"
)
@Transactional
public void onSeatsLocked(SeatsLockedEvent event) {
    // Idempotency check
    if (bookingRepo.findById(event.getBookingId())
            .map(b -> b.getStatus() != BookingStatus.PENDING)
            .orElse(true)) {
        return; // already processed or booking not found
    }
    kafkaTemplate.send("ticketflow.payment.requested",
        event.getBookingId(),
        buildPaymentRequestedEvent(event));
}
```

---

## Key Business Logic

### Transactional outbox pattern

Booking inserts and Kafka publishes are wrapped in a single Spring `@Transactional` block. If the Kafka publish fails, the DB write is rolled back. This prevents a state where the booking is saved but `booking.initiated` is never published.

```java
@Transactional
public BookingResponse createBooking(CreateBookingRequest req, String userId) {
    Booking booking = bookingRepo.save(buildBooking(req, userId));
    kafkaTemplate.send("ticketflow.booking.initiated",
        booking.getId(),
        buildInitiatedEvent(booking));
    return new BookingResponse(booking.getId(), "PENDING");
}
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `SERVER_PORT` | Listening port | `3003` |
| `SPRING_DATASOURCE_URL` | PostgreSQL JDBC URL | `jdbc:postgresql://postgres:5432/ticketflow` |
| `SPRING_DATASOURCE_USERNAME` | DB username | `ticketflow` |
| `SPRING_DATASOURCE_PASSWORD` | DB password | — |
| `KAFKA_BOOTSTRAP_SERVERS` | Kafka broker | `kafka:9092` |
| `CANCELLATION_WINDOW_HOURS` | Hours before event that cancellation is allowed | `24` |

---

## Local Development

```bash
cd services/booking-service
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

---

## Docker Build

```dockerfile
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app
COPY pom.xml ./
COPY src ./src
RUN ./mvnw package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 3003
ENTRYPOINT ["java", "-jar", "app.jar"]
```
