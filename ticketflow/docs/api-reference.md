# API Reference

All requests are routed through the API Gateway at `http://localhost:3000` (dev) or `https://tickets.yourdomain.com` (prod).

## Table of Contents

- [Authentication](#authentication)
- [Common Response Formats](#common-response-formats)
- [Gateway](#gateway)
- [User Service](#user-service)
- [Event Service](#event-service)
- [Booking Service](#booking-service)
- [Inventory Service](#inventory-service)
- [Payment Service](#payment-service)
- [Notification Service](#notification-service)

---

## Authentication

TicketFlow uses **JWT Bearer tokens** for authentication.

### Obtaining a token

```bash
curl -s -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@ticketflow.dev", "password": "Test1234!"}'
```

Response:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2024-06-02T10:00:00Z",
  "user": {
    "id": "usr_01HX9ABC456",
    "name": "Test User",
    "email": "test@ticketflow.dev",
    "role": "USER"
  }
}
```

### Using the token

Include the token in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### JWT payload

```json
{
  "sub": "usr_01HX9ABC456",
  "name": "Test User",
  "email": "test@ticketflow.dev",
  "role": "USER",
  "iat": 1717228800,
  "exp": 1717315200
}
```

### Roles

| Role | Description |
|---|---|
| `USER` | Standard user — can browse events, make bookings, view own data |
| `ADMIN` | Can create/update events and venues |

---

## Common Response Formats

### Success

```json
{
  "data": { ... },
  "meta": {
    "requestId": "req_01HX...",
    "timestamp": "2024-06-01T10:00:00Z"
  }
}
```

For collections:

```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 142,
    "totalPages": 8
  }
}
```

### Error

```json
{
  "error": {
    "code": "BOOKING_NOT_FOUND",
    "message": "Booking bkg_01HZ3ABC does not exist",
    "requestId": "req_01HX..."
  }
}
```

### HTTP Status Codes

| Code | Meaning |
|---|---|
| `200` | OK |
| `201` | Created |
| `202` | Accepted (async operation started) |
| `400` | Bad Request — validation error |
| `401` | Unauthorized — missing or invalid token |
| `403` | Forbidden — valid token but insufficient role |
| `404` | Not Found |
| `409` | Conflict — e.g. email already registered |
| `422` | Unprocessable Entity — business rule violation |
| `500` | Internal Server Error |

---

## Gateway

### GET /health

Health check for the gateway itself.

**Auth:** None

**Response `200`:**

```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 3600
}
```

---

## User Service

Base path: `/api/users`

---

### POST /api/users/register

Register a new user account.

**Auth:** None

**Request Body:**

```json
{
  "name": "string (required, 2-100 chars)",
  "email": "string (required, valid email)",
  "password": "string (required, min 8 chars, must contain uppercase, number)"
}
```

**Response `201`:**

```json
{
  "id": "usr_01HX9ABC456",
  "name": "Alice Example",
  "email": "alice@example.com",
  "role": "USER",
  "createdAt": "2024-06-01T10:00:00Z"
}
```

**Error Codes:**

| Code | HTTP | Description |
|---|---|---|
| `EMAIL_ALREADY_EXISTS` | 409 | Email is already registered |
| `VALIDATION_ERROR` | 400 | Invalid name, email, or weak password |

---

### POST /api/users/login

Authenticate and receive a JWT.

**Auth:** None

**Request Body:**

```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response `200`:**

```json
{
  "token": "eyJ...",
  "expiresAt": "2024-06-02T10:00:00Z",
  "user": {
    "id": "usr_01HX9ABC456",
    "name": "Alice Example",
    "email": "alice@example.com",
    "role": "USER"
  }
}
```

**Error Codes:**

| Code | HTTP | Description |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Email/password combination incorrect |

---

### GET /api/users/me

Get the authenticated user's profile.

**Auth:** Required

**Response `200`:**

```json
{
  "id": "usr_01HX9ABC456",
  "name": "Alice Example",
  "email": "alice@example.com",
  "role": "USER",
  "createdAt": "2024-06-01T10:00:00Z"
}
```

---

## Event Service

Base path: `/api/events`, `/api/venues`

---

### GET /api/events

List all upcoming events, ordered by date ascending.

**Auth:** None

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `page` | integer | Page number (default: 1) |
| `perPage` | integer | Items per page (default: 20, max: 100) |
| `venueId` | string | Filter by venue |
| `from` | ISO-8601 date | Filter events starting on or after date |
| `to` | ISO-8601 date | Filter events starting before date |

**Response `200`:**

```json
{
  "data": [
    {
      "id": "evnt_01HX1ABC",
      "name": "Coldplay: Music of the Spheres",
      "description": "World tour 2024",
      "venue": {
        "id": "ven_01HX2DEF",
        "name": "O2 Arena",
        "city": "London"
      },
      "startsAt": "2024-09-15T19:30:00Z",
      "endsAt": "2024-09-15T23:00:00Z",
      "availableSeats": 14320,
      "totalSeats": 20000,
      "ticketTiers": [
        {"tier": "GENERAL", "price": 7500, "currency": "GBP", "available": 12000},
        {"tier": "VIP", "price": 25000, "currency": "GBP", "available": 2320}
      ]
    }
  ],
  "pagination": { "page": 1, "perPage": 20, "total": 4, "totalPages": 1 }
}
```

---

### GET /api/events/:id

Get full details for a single event.

**Auth:** None

**Response `200`:** Same as a single item from the list above, plus full `seatMap` object.

**Error Codes:**

| Code | HTTP | Description |
|---|---|---|
| `EVENT_NOT_FOUND` | 404 | Event ID does not exist |

---

### POST /api/events

Create a new event.

**Auth:** Required (ADMIN role)

**Request Body:**

```json
{
  "name": "string (required)",
  "description": "string",
  "venueId": "string (required)",
  "startsAt": "ISO-8601 datetime (required)",
  "endsAt": "ISO-8601 datetime (required)",
  "ticketTiers": [
    {
      "tier": "string (GENERAL | VIP | STANDING)",
      "price": "integer (minor currency units)",
      "currency": "string (ISO 4217)",
      "capacity": "integer"
    }
  ]
}
```

**Response `201`:**

```json
{
  "id": "evnt_02HY2DEF",
  "name": "New Event",
  "createdAt": "2024-06-01T12:00:00Z"
}
```

---

### PUT /api/events/:id

Update an existing event.

**Auth:** Required (ADMIN role)

**Request Body:** Same fields as POST, all optional.

**Response `200`:** Updated event object.

---

### POST /api/venues

Create a venue.

**Auth:** Required (ADMIN role)

**Request Body:**

```json
{
  "name": "string (required)",
  "address": "string (required)",
  "city": "string (required)",
  "country": "string (required, ISO 3166-1 alpha-2)",
  "capacity": "integer (required)"
}
```

**Response `201`:**

```json
{
  "id": "ven_02HY3GHI",
  "name": "Madison Square Garden",
  "city": "New York",
  "country": "US",
  "capacity": 20789
}
```

---

### GET /api/venues/:id

Get venue details.

**Auth:** None

**Response `200`:** Venue object including events scheduled at this venue.

---

## Booking Service

Base path: `/api/bookings`

---

### POST /api/bookings

Initiate a new booking. This is an **asynchronous** operation. The server returns `202 Accepted` immediately and the booking is processed via the Kafka saga. Poll `GET /api/bookings/:id` for the final status.

**Auth:** Required

**Request Body:**

```json
{
  "eventId": "string (required)",
  "seatIds": ["string (required, 1-10 seats)"],
  "paymentMethod": {
    "type": "card",
    "token": "string (Stripe payment method token)"
  }
}
```

**Response `202`:**

```json
{
  "bookingId": "bkg_01HZ3ABC",
  "status": "PENDING",
  "message": "Booking is being processed. Poll GET /api/bookings/bkg_01HZ3ABC for status."
}
```

**Error Codes:**

| Code | HTTP | Description |
|---|---|---|
| `EVENT_NOT_FOUND` | 404 | Event ID does not exist |
| `INVALID_SEAT_COUNT` | 400 | Must book between 1 and 10 seats |
| `VALIDATION_ERROR` | 400 | Missing required fields |

---

### GET /api/bookings/my

List all bookings for the authenticated user.

**Auth:** Required

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `status` | string | Filter: PENDING, CONFIRMED, FAILED, CANCELLED |
| `page` | integer | Page number |

**Response `200`:**

```json
{
  "data": [
    {
      "id": "bkg_01HZ3ABC",
      "eventId": "evnt_01HX1ABC",
      "eventName": "Coldplay: Music of the Spheres",
      "eventDate": "2024-09-15T19:30:00Z",
      "seatIds": ["seat_A1", "seat_A2"],
      "status": "CONFIRMED",
      "totalAmount": 15000,
      "currency": "GBP",
      "createdAt": "2024-06-15T14:22:00Z",
      "confirmedAt": "2024-06-15T14:22:05Z"
    }
  ]
}
```

---

### GET /api/bookings/:id

Get the current status of a specific booking.

**Auth:** Required (must be the booking owner or ADMIN)

**Response `200`:**

```json
{
  "id": "bkg_01HZ3ABC",
  "userId": "usr_01HX9ABC456",
  "eventId": "evnt_01HX1ABC",
  "eventName": "Coldplay: Music of the Spheres",
  "eventDate": "2024-09-15T19:30:00Z",
  "venueName": "O2 Arena",
  "seatIds": ["seat_A1", "seat_A2"],
  "status": "CONFIRMED",
  "totalAmount": 15000,
  "currency": "GBP",
  "paymentId": "pay_01HZ5DEF",
  "createdAt": "2024-06-15T14:22:00Z",
  "confirmedAt": "2024-06-15T14:22:05Z"
}
```

**Booking Status Values:**

| Status | Description |
|---|---|
| `PENDING` | Saga is in progress |
| `CONFIRMED` | Payment successful, seats reserved |
| `FAILED` | Saga failed (seat unavailable or payment declined) |
| `CANCELLED` | User cancelled the booking |

---

### POST /api/bookings/:id/cancel

Cancel a confirmed booking.

**Auth:** Required (must be booking owner)

**Request Body:** Empty `{}`

**Response `200`:**

```json
{
  "bookingId": "bkg_01HZ3ABC",
  "status": "CANCELLED",
  "refundAmount": 15000,
  "currency": "GBP",
  "cancelledAt": "2024-06-16T09:00:00Z"
}
```

**Error Codes:**

| Code | HTTP | Description |
|---|---|---|
| `BOOKING_NOT_FOUND` | 404 | Booking ID does not exist |
| `BOOKING_NOT_CANCELLABLE` | 422 | Booking is not in CONFIRMED status |
| `CANCELLATION_WINDOW_EXPIRED` | 422 | Event is less than 24 hours away |

---

## Inventory Service

Base path: `/api/inventory`

---

### GET /api/inventory/events/:eventId/seats

Get the current availability status of all seats for an event.

**Auth:** None

**Response `200`:**

```json
{
  "eventId": "evnt_01HX1ABC",
  "seats": [
    {
      "id": "seat_A1",
      "row": "A",
      "number": 1,
      "tier": "VIP",
      "price": 25000,
      "currency": "GBP",
      "status": "AVAILABLE"
    },
    {
      "id": "seat_A2",
      "row": "A",
      "number": 2,
      "tier": "VIP",
      "price": 25000,
      "currency": "GBP",
      "status": "LOCKED"
    },
    {
      "id": "seat_B1",
      "row": "B",
      "number": 1,
      "tier": "GENERAL",
      "price": 7500,
      "currency": "GBP",
      "status": "RESERVED"
    }
  ],
  "summary": {
    "total": 20000,
    "available": 14320,
    "locked": 150,
    "reserved": 5530
  }
}
```

**Seat Status Values:**

| Status | Description |
|---|---|
| `AVAILABLE` | Can be booked |
| `LOCKED` | Temporarily held (Redis TTL, max 5 min) |
| `RESERVED` | Sold — booking confirmed |

---

## Payment Service

Base path: `/api/payments`

---

### GET /api/payments/:id

Get details of a specific payment.

**Auth:** Required (must be payment owner or ADMIN)

**Response `200`:**

```json
{
  "id": "pay_01HZ5DEF",
  "bookingId": "bkg_01HZ3ABC",
  "userId": "usr_01HX9ABC456",
  "amount": 15000,
  "currency": "GBP",
  "status": "SUCCESS",
  "providerTransactionId": "ch_3PQR7sSt8uVwXyZ9",
  "processedAt": "2024-06-15T14:22:03Z"
}
```

---

### GET /api/payments/booking/:bookingId

Get the payment associated with a booking.

**Auth:** Required (must be booking owner or ADMIN)

**Response `200`:** Same as `GET /api/payments/:id`.

**Error Codes:**

| Code | HTTP | Description |
|---|---|---|
| `PAYMENT_NOT_FOUND` | 404 | No payment found for booking |

---

## Notification Service

Base path: `/api/notifications`

---

### GET /api/notifications/recent

Get the most recent 20 notifications for the authenticated user.

**Auth:** Required

**Response `200`:**

```json
{
  "data": [
    {
      "id": "notif_01HZ7GHI",
      "type": "BOOKING_CONFIRMED",
      "subject": "Your booking is confirmed!",
      "sentAt": "2024-06-15T14:22:05Z",
      "bookingId": "bkg_01HZ3ABC"
    }
  ]
}
```

---

### GET /api/notifications/health

Health check for the Notification Service.

**Auth:** None

**Response `200`:**

```json
{
  "status": "ok",
  "kafka": "connected",
  "mongodb": "connected",
  "smtp": "reachable"
}
```
