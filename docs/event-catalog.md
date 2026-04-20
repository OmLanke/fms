# Event Catalog

All asynchronous inter-service communication in TicketFlow flows through Apache Kafka. This document is the authoritative reference for every topic, payload schema, and consumer group assignment.

## Table of Contents

- [Naming Convention](#naming-convention)
- [Broker Configuration](#broker-configuration)
- [Consumer Groups](#consumer-groups)
- [Topic Reference](#topic-reference)
  - [ticketflow.user.registered](#ticketflowuserregistered)
  - [ticketflow.event.created](#ticketfloweventcreated)
  - [ticketflow.booking.initiated](#ticketflowbookinginitiated)
  - [ticketflow.seats.locked](#ticketflowseatslocked)
  - [ticketflow.seats.lock-failed](#ticketflowseatslock-failed)
  - [ticketflow.seats.confirm](#ticketflowseatsconfirm)
  - [ticketflow.seats.release](#ticketflowseatsrelease)
  - [ticketflow.payment.requested](#ticketflowpaymentrequested)
  - [ticketflow.payment.processed](#ticketflowpaymentprocessed)
  - [ticketflow.booking.confirmed](#ticketflowbookingconfirmed)
  - [ticketflow.booking.failed](#ticketflowbookingfailed)
  - [ticketflow.booking.cancelled](#ticketflowbookingcancelled)
- [Dead-Letter Topics](#dead-letter-topics)

---

## Naming Convention

```
ticketflow.<domain>.<event-type>
```

| Segment | Example | Description |
|---|---|---|
| `ticketflow` | `ticketflow` | Platform namespace; allows multi-tenant broker sharing |
| `<domain>` | `booking`, `seats`, `payment` | Bounded context of the producing service |
| `<event-type>` | `initiated`, `confirmed`, `processed` | Past-tense verb describing what happened |

Event names describe facts about the world, not commands. A service publishes what happened; it does not tell other services what to do.

---

## Broker Configuration

| Property | Value |
|---|---|
| Bootstrap servers | `kafka:9092` (internal) |
| Replication factor (dev) | 1 |
| Replication factor (prod) | 3 |
| Min in-sync replicas (prod) | 2 |
| Compression | `snappy` |
| Message max bytes | `1 MB` |
| Serialization | JSON (UTF-8) |

---

## Consumer Groups

| Consumer Group ID | Topics Consumed |
|---|---|
| `inventory-service` | `ticketflow.booking.initiated`, `ticketflow.seats.confirm`, `ticketflow.seats.release`, `ticketflow.booking.cancelled` |
| `payment-service` | `ticketflow.payment.requested` |
| `booking-service` | `ticketflow.seats.locked`, `ticketflow.seats.lock-failed`, `ticketflow.payment.processed` |
| `notification-service` | `ticketflow.booking.confirmed`, `ticketflow.booking.failed`, `ticketflow.booking.cancelled`, `ticketflow.user.registered` |

---

## Topic Reference

---

### ticketflow.user.registered

**Producer:** User Service  
**Consumers:** Notification Service  
**Partitions:** 3  
**Partition key:** `userId`  
**Retention:** 3 days  
**Purpose:** Triggers a welcome email after a new user registers.

#### Payload Schema

```json
{
  "eventId": "string",
  "eventType": "user.registered",
  "occurredAt": "ISO-8601 datetime",
  "payload": {
    "userId": "string — unique user identifier",
    "name": "string — full name",
    "email": "string — email address",
    "registeredAt": "ISO-8601 datetime"
  }
}
```

#### Example

```json
{
  "eventId": "evt_01HX9ABC123",
  "eventType": "user.registered",
  "occurredAt": "2024-06-01T10:00:00Z",
  "payload": {
    "userId": "usr_01HX9ABC456",
    "name": "Alice Example",
    "email": "alice@example.com",
    "registeredAt": "2024-06-01T10:00:00Z"
  }
}
```

---

### ticketflow.event.created

**Producer:** Event Service  
**Consumers:** None (analytics / future use)  
**Partitions:** 3  
**Partition key:** `eventId`  
**Retention:** 7 days  
**Purpose:** Publishes a fact when a new ticketed event is created.

#### Payload Schema

```json
{
  "eventId": "string",
  "eventType": "event.created",
  "occurredAt": "ISO-8601 datetime",
  "payload": {
    "eventId": "string — unique event identifier",
    "name": "string — event name",
    "venueId": "string — venue identifier",
    "startsAt": "ISO-8601 datetime",
    "totalSeats": "integer — total capacity",
    "ticketTiers": [
      {
        "tier": "string — e.g. GENERAL, VIP",
        "price": "number — price in minor currency units (pence/cents)",
        "currency": "string — ISO 4217 code e.g. GBP"
      }
    ]
  }
}
```

#### Example

```json
{
  "eventId": "evt_02HY1DEF789",
  "eventType": "event.created",
  "occurredAt": "2024-06-01T09:00:00Z",
  "payload": {
    "eventId": "evnt_01HX1ABC",
    "name": "Coldplay: Music of the Spheres",
    "venueId": "ven_01HX2DEF",
    "startsAt": "2024-09-15T19:30:00Z",
    "totalSeats": 20000,
    "ticketTiers": [
      {"tier": "GENERAL", "price": 7500, "currency": "GBP"},
      {"tier": "VIP", "price": 25000, "currency": "GBP"}
    ]
  }
}
```

---

### ticketflow.booking.initiated

**Producer:** Booking Service  
**Consumers:** Inventory Service  
**Partitions:** 6  
**Partition key:** `bookingId`  
**Retention:** 7 days  
**Purpose:** Starts the booking saga. Inventory Service reacts by attempting to lock the requested seats.

#### Payload Schema

```json
{
  "eventId": "string",
  "eventType": "booking.initiated",
  "occurredAt": "ISO-8601 datetime",
  "payload": {
    "bookingId": "string — unique booking identifier",
    "userId": "string — user who initiated the booking",
    "eventId": "string — ticketed event identifier",
    "seatIds": ["string — array of requested seat IDs"],
    "totalAmount": "integer — total price in minor currency units",
    "currency": "string — ISO 4217",
    "paymentMethodToken": "string — tokenised payment method (e.g. Stripe token)",
    "idempotencyKey": "string — UUID for exactly-once payment"
  }
}
```

#### Example

```json
{
  "eventId": "evt_03HZ2GHI012",
  "eventType": "booking.initiated",
  "occurredAt": "2024-06-15T14:22:00Z",
  "payload": {
    "bookingId": "bkg_01HZ3ABC",
    "userId": "usr_01HX9ABC456",
    "eventId": "evnt_01HX1ABC",
    "seatIds": ["seat_A1", "seat_A2"],
    "totalAmount": 15000,
    "currency": "GBP",
    "paymentMethodToken": "tok_visa",
    "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

### ticketflow.seats.locked

**Producer:** Inventory Service  
**Consumers:** Booking Service  
**Partitions:** 6  
**Partition key:** `bookingId`  
**Retention:** 7 days  
**Purpose:** Confirms all requested seats have been locked in Redis and the DB. Booking Service proceeds to request payment.

#### Payload Schema

```json
{
  "eventId": "string",
  "eventType": "seats.locked",
  "occurredAt": "ISO-8601 datetime",
  "payload": {
    "bookingId": "string",
    "eventId": "string",
    "seatIds": ["string — locked seat IDs"],
    "lockExpiresAt": "ISO-8601 datetime — Redis TTL expiry"
  }
}
```

#### Example

```json
{
  "eventId": "evt_04HA3JKL345",
  "eventType": "seats.locked",
  "occurredAt": "2024-06-15T14:22:01Z",
  "payload": {
    "bookingId": "bkg_01HZ3ABC",
    "eventId": "evnt_01HX1ABC",
    "seatIds": ["seat_A1", "seat_A2"],
    "lockExpiresAt": "2024-06-15T14:27:01Z"
  }
}
```

---

### ticketflow.seats.lock-failed

**Producer:** Inventory Service  
**Consumers:** Booking Service  
**Partitions:** 6  
**Partition key:** `bookingId`  
**Retention:** 7 days  
**Purpose:** Reports that one or more requested seats could not be locked (already held by another booking). Booking Service marks the booking FAILED and terminates the saga.

#### Payload Schema

```json
{
  "eventId": "string",
  "eventType": "seats.lock-failed",
  "occurredAt": "ISO-8601 datetime",
  "payload": {
    "bookingId": "string",
    "eventId": "string",
    "requestedSeatIds": ["string — all requested seats"],
    "unavailableSeatIds": ["string — seats that could not be locked"],
    "reason": "string — human-readable explanation"
  }
}
```

---

### ticketflow.seats.confirm

**Producer:** Booking Service  
**Consumers:** Inventory Service  
**Partitions:** 6  
**Partition key:** `bookingId`  
**Retention:** 7 days  
**Purpose:** Instructs Inventory Service to move seats from LOCKED to RESERVED and remove Redis keys.

#### Payload Schema

```json
{
  "eventId": "string",
  "eventType": "seats.confirm",
  "occurredAt": "ISO-8601 datetime",
  "payload": {
    "bookingId": "string",
    "eventId": "string",
    "seatIds": ["string"]
  }
}
```

---

### ticketflow.seats.release

**Producer:** Booking Service or Payment Service  
**Consumers:** Inventory Service  
**Partitions:** 6  
**Partition key:** `bookingId`  
**Retention:** 7 days  
**Purpose:** Compensating transaction. Instructs Inventory Service to move seats from LOCKED back to AVAILABLE and remove Redis keys.

#### Payload Schema

```json
{
  "eventId": "string",
  "eventType": "seats.release",
  "occurredAt": "ISO-8601 datetime",
  "payload": {
    "bookingId": "string",
    "eventId": "string",
    "seatIds": ["string"],
    "reason": "string — e.g. PAYMENT_FAILED, BOOKING_CANCELLED"
  }
}
```

---

### ticketflow.payment.requested

**Producer:** Booking Service  
**Consumers:** Payment Service  
**Partitions:** 6  
**Partition key:** `bookingId`  
**Retention:** 7 days  
**Purpose:** Instructs Payment Service to charge the customer's payment method.

#### Payload Schema

```json
{
  "eventId": "string",
  "eventType": "payment.requested",
  "occurredAt": "ISO-8601 datetime",
  "payload": {
    "bookingId": "string",
    "userId": "string",
    "amount": "integer — in minor currency units",
    "currency": "string — ISO 4217",
    "paymentMethodToken": "string",
    "idempotencyKey": "string — UUID, must be preserved from booking.initiated"
  }
}
```

---

### ticketflow.payment.processed

**Producer:** Payment Service  
**Consumers:** Booking Service  
**Partitions:** 6  
**Partition key:** `bookingId`  
**Retention:** 7 days  
**Purpose:** Reports the outcome of the payment attempt. Booking Service uses this to confirm or fail the booking.

#### Payload Schema

```json
{
  "eventId": "string",
  "eventType": "payment.processed",
  "occurredAt": "ISO-8601 datetime",
  "payload": {
    "bookingId": "string",
    "paymentId": "string — Payment Service internal ID",
    "status": "string — SUCCESS | FAILED",
    "amount": "integer",
    "currency": "string",
    "providerTransactionId": "string — Stripe charge ID or null",
    "failureReason": "string | null — reason if FAILED"
  }
}
```

#### Example (success)

```json
{
  "eventId": "evt_05HB4MNO678",
  "eventType": "payment.processed",
  "occurredAt": "2024-06-15T14:22:03Z",
  "payload": {
    "bookingId": "bkg_01HZ3ABC",
    "paymentId": "pay_01HZ5DEF",
    "status": "SUCCESS",
    "amount": 15000,
    "currency": "GBP",
    "providerTransactionId": "ch_3PQR7sSt8uVwXyZ9",
    "failureReason": null
  }
}
```

#### Example (failure)

```json
{
  "payload": {
    "bookingId": "bkg_01HZ3ABC",
    "status": "FAILED",
    "failureReason": "card_declined",
    "providerTransactionId": null
  }
}
```

---

### ticketflow.booking.confirmed

**Producer:** Booking Service  
**Consumers:** Notification Service  
**Partitions:** 3  
**Partition key:** `userId`  
**Retention:** 3 days  
**Purpose:** Booking is fully confirmed. Notification Service sends the confirmation email.

#### Payload Schema

```json
{
  "eventId": "string",
  "eventType": "booking.confirmed",
  "occurredAt": "ISO-8601 datetime",
  "payload": {
    "bookingId": "string",
    "userId": "string",
    "userEmail": "string",
    "userName": "string",
    "eventId": "string",
    "eventName": "string",
    "eventDate": "ISO-8601 datetime",
    "venueName": "string",
    "seatIds": ["string"],
    "totalAmount": "integer",
    "currency": "string",
    "paymentId": "string"
  }
}
```

---

### ticketflow.booking.failed

**Producer:** Booking Service  
**Consumers:** Notification Service  
**Partitions:** 3  
**Partition key:** `userId`  
**Retention:** 3 days  
**Purpose:** Booking failed (seat unavailability or payment failure). Notification Service sends a failure email.

#### Payload Schema

```json
{
  "eventId": "string",
  "eventType": "booking.failed",
  "occurredAt": "ISO-8601 datetime",
  "payload": {
    "bookingId": "string",
    "userId": "string",
    "userEmail": "string",
    "userName": "string",
    "eventId": "string",
    "eventName": "string",
    "reason": "string — SEATS_UNAVAILABLE | PAYMENT_FAILED | INTERNAL_ERROR",
    "failureDetail": "string | null"
  }
}
```

---

### ticketflow.booking.cancelled

**Producer:** Booking Service  
**Consumers:** Notification Service, Inventory Service  
**Partitions:** 3  
**Partition key:** `userId`  
**Retention:** 7 days  
**Purpose:** User cancelled a confirmed booking. Inventory Service releases seats; Notification Service sends cancellation email.

#### Payload Schema

```json
{
  "eventId": "string",
  "eventType": "booking.cancelled",
  "occurredAt": "ISO-8601 datetime",
  "payload": {
    "bookingId": "string",
    "userId": "string",
    "userEmail": "string",
    "userName": "string",
    "eventId": "string",
    "eventName": "string",
    "seatIds": ["string"],
    "refundAmount": "integer — in minor currency units",
    "currency": "string",
    "cancelledAt": "ISO-8601 datetime"
  }
}
```

---

## Dead-Letter Topics

Each consumer that handles saga-critical messages has a corresponding Dead-Letter Topic (DLT). Messages are forwarded to the DLT after 3 retries with exponential backoff.

| DLT Topic | Source Topic | Retention |
|---|---|---|
| `ticketflow.booking.initiated.DLT` | `ticketflow.booking.initiated` | 30 days |
| `ticketflow.payment.requested.DLT` | `ticketflow.payment.requested` | 30 days |
| `ticketflow.seats.locked.DLT` | `ticketflow.seats.locked` | 30 days |
| `ticketflow.booking.confirmed.DLT` | `ticketflow.booking.confirmed` | 30 days |

### DLT Envelope

Messages forwarded to a DLT are wrapped with additional metadata:

```json
{
  "originalTopic": "string — source topic",
  "originalPartition": "integer",
  "originalOffset": "integer",
  "failureReason": "string — exception class name",
  "failureMessage": "string — exception message",
  "attempts": "integer — number of attempts before DLT",
  "failedAt": "ISO-8601 datetime",
  "originalPayload": { ... }
}
```

### Replaying DLT Messages

To replay a DLT message after fixing the underlying issue:

```bash
# Using Redpanda Console: Topics → select DLT topic → Messages → Re-publish to original topic
# Or via CLI:
docker exec -it ticketflow-kafka-1 \
  kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic ticketflow.payment.requested.DLT \
  --from-beginning | \
  kafka-console-producer.sh \
  --bootstrap-server localhost:9092 \
  --topic ticketflow.payment.requested
```
