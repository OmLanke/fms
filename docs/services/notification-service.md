# Notification Service

## Responsibility

The Notification Service is a pure Kafka consumer. It:

- Listens for booking lifecycle events and user registration events.
- Renders HTML email templates using Jinja2.
- Sends emails via SMTP (Mailpit in dev, real SMTP in prod).
- Persists a notification log entry in MongoDB for each sent notification.
- Provides a read endpoint for a user's recent notifications.

The Notification Service has no HTTP write endpoints — it only reacts to Kafka events.

---

## Technology Stack

| Component | Technology |
|---|---|
| Runtime | Python 3.12 |
| Framework | FastAPI |
| Language | Python |
| Database | MongoDB 7 |
| DB Driver | Motor (async) |
| Kafka | confluent-kafka-python |
| Email | aiosmtplib + Jinja2 |
| Validation | Pydantic v2 |
| Metrics | prometheus-client |

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/notifications/recent` | Yes (X-User-Id) | Last 20 notifications for user |
| GET | `/health` | No | Health check (Kafka + MongoDB + SMTP) |
| GET | `/metrics` | No | Prometheus metrics |

---

## Database Schema (MongoDB `notifications` collection)

```javascript
{
  _id: ObjectId,
  id: String,              // ULID
  userId: String,
  type: String,            // WELCOME | BOOKING_CONFIRMED | BOOKING_FAILED | BOOKING_CANCELLED
  subject: String,
  recipientEmail: String,
  bookingId: String,       // null for WELCOME notifications
  status: String,          // SENT | FAILED
  sentAt: Date,
  errorMessage: String,    // null if SENT
  createdAt: Date
}
```

Indexes:
- `{ userId: 1, createdAt: -1 }` — for recent notifications endpoint
- `{ bookingId: 1 }` — for looking up notification by booking

---

## Kafka Topics

| Topic | Direction | When |
|---|---|---|
| `ticketflow.booking.confirmed` | **Consumed** | Send booking confirmation email |
| `ticketflow.booking.failed` | **Consumed** | Send booking failure email |
| `ticketflow.booking.cancelled` | **Consumed** | Send cancellation email |
| `ticketflow.user.registered` | **Consumed** | Send welcome email |

---

## Email Templates

Templates are in `app/templates/`:

| Template File | Used For |
|---|---|
| `welcome.html` | `user.registered` event |
| `booking_confirmed.html` | `booking.confirmed` event |
| `booking_failed.html` | `booking.failed` event |
| `booking_cancelled.html` | `booking.cancelled` event |

Example template excerpt (`booking_confirmed.html`):

```html
<!DOCTYPE html>
<html>
<body>
  <h1>Your booking is confirmed!</h1>
  <p>Hi {{ user_name }},</p>
  <p>
    Your booking for <strong>{{ event_name }}</strong> on
    {{ event_date | datetimeformat }} at {{ venue_name }} is confirmed.
  </p>
  <table>
    <tr><th>Booking ID</th><td>{{ booking_id }}</td></tr>
    <tr><th>Seats</th><td>{{ seat_ids | join(', ') }}</td></tr>
    <tr><th>Total</th><td>{{ total_amount | currency(currency) }}</td></tr>
    <tr><th>Payment ID</th><td>{{ payment_id }}</td></tr>
  </table>
</body>
</html>
```

---

## Key Business Logic

### Event handler pattern

```python
async def handle_booking_confirmed(event: BookingConfirmedEvent):
    html_body = render_template("booking_confirmed.html", {
        "user_name": event.payload.user_name,
        "event_name": event.payload.event_name,
        "event_date": event.payload.event_date,
        "venue_name": event.payload.venue_name,
        "booking_id": event.payload.booking_id,
        "seat_ids": event.payload.seat_ids,
        "total_amount": event.payload.total_amount,
        "currency": event.payload.currency,
        "payment_id": event.payload.payment_id,
    })

    notification_id = ulid()
    try:
        await send_email(
            to=event.payload.user_email,
            subject=f"Booking confirmed — {event.payload.event_name}",
            html_body=html_body,
        )
        status = "SENT"
        error_message = None
    except SMTPException as e:
        status = "FAILED"
        error_message = str(e)
        logger.error(f"Failed to send confirmation email for booking {event.payload.booking_id}: {e}")

    await db.notifications.insert_one({
        "id": notification_id,
        "userId": event.payload.user_id,
        "type": "BOOKING_CONFIRMED",
        "subject": f"Booking confirmed — {event.payload.event_name}",
        "recipientEmail": event.payload.user_email,
        "bookingId": event.payload.booking_id,
        "status": status,
        "sentAt": datetime.utcnow(),
        "errorMessage": error_message,
        "createdAt": datetime.utcnow(),
    })
```

### SMTP configuration

```python
async def send_email(to: str, subject: str, html_body: str):
    message = MIMEMultipart("alternative")
    message["From"] = settings.email_from
    message["To"] = to
    message["Subject"] = subject
    message.attach(MIMEText(html_body, "html"))

    async with aiosmtplib.SMTP(
        hostname=settings.smtp_host,
        port=settings.smtp_port,
    ) as smtp:
        await smtp.send_message(message)
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Listening port | `3006` |
| `MONGODB_URL` | MongoDB connection string | `mongodb://ticketflow:pass@mongodb:27017/ticketflow_notifications` |
| `KAFKA_BOOTSTRAP_SERVERS` | Kafka broker | `kafka:9092` |
| `SMTP_HOST` | SMTP server hostname | `mailpit` |
| `SMTP_PORT` | SMTP port | `1025` |
| `EMAIL_FROM` | Sender address | `noreply@ticketflow.dev` |

---

## Local Development

```bash
cd services/notification-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 3006

# Emails are captured in Mailpit at http://localhost:8025
```

---

## Docker Build

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
EXPOSE 3006
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3006"]
```
