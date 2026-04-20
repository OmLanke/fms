# Payment Service

## Responsibility

The Payment Service processes payments on behalf of the booking saga. It:

- Consumes `payment.requested` Kafka events.
- Charges the customer's payment method via the Stripe API.
- Persists a payment record in MongoDB.
- Publishes `payment.processed` with the result (SUCCESS or FAILED).
- Provides a read endpoint for payment details.

The Payment Service does **not** initiate payments proactively. It only acts in response to `payment.requested` events.

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
| Payment Provider | Stripe Python SDK |
| Validation | Pydantic v2 |
| Metrics | prometheus-client |
| Tracing | OpenTelemetry |

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/payments/{id}` | Yes (X-User-Id) | Get payment details |
| GET | `/payments/booking/{bookingId}` | Yes | Get payment by booking |
| GET | `/health` | No | Health check |
| GET | `/metrics` | No | Prometheus metrics |

---

## Database Schema (MongoDB `payments` collection)

```javascript
{
  _id: ObjectId,
  id: String,                    // ULID
  bookingId: String,
  userId: String,
  amount: Number,                // minor currency units
  currency: String,              // ISO 4217
  status: String,                // PENDING | SUCCESS | FAILED
  idempotencyKey: String,        // UUID from booking.initiated — unique index
  providerTransactionId: String, // Stripe charge ID (null if failed)
  failureReason: String,         // null if success
  stripeResponse: Object,        // raw Stripe API response (for audit)
  processedAt: Date,
  createdAt: Date
}
```

Indexes:
- `{ idempotencyKey: 1 }` — unique, enforces exactly-once payment
- `{ bookingId: 1 }` — for booking lookup endpoint
- `{ userId: 1, createdAt: -1 }` — for user payment history

---

## Kafka Topics

| Topic | Direction | When |
|---|---|---|
| `ticketflow.payment.processed` | **Produced** | After charge attempt (success or failure) |
| `ticketflow.payment.requested` | **Consumed** | Process payment |

---

## Key Business Logic

### Idempotent payment processing

The `idempotencyKey` (UUID carried from `booking.initiated`) is used as the Stripe idempotency key AND as a unique MongoDB key. This prevents double-charging if the Kafka message is replayed.

```python
async def process_payment(event: PaymentRequestedEvent) -> PaymentRecord:
    # Check if already processed (idempotent replay protection)
    existing = await db.payments.find_one({"idempotencyKey": event.idempotency_key})
    if existing:
        return PaymentRecord(**existing)

    try:
        charge = stripe.PaymentIntent.create(
            amount=event.amount,
            currency=event.currency.lower(),
            payment_method=event.payment_method_token,
            confirm=True,
            idempotency_key=event.idempotency_key,
        )
        status = "SUCCESS"
        provider_tx_id = charge.id
        failure_reason = None
    except stripe.error.CardError as e:
        status = "FAILED"
        provider_tx_id = None
        failure_reason = e.code  # e.g. "card_declined", "insufficient_funds"

    payment = PaymentRecord(
        id=ulid(),
        booking_id=event.booking_id,
        user_id=event.user_id,
        amount=event.amount,
        currency=event.currency,
        status=status,
        idempotency_key=event.idempotency_key,
        provider_transaction_id=provider_tx_id,
        failure_reason=failure_reason,
        processed_at=datetime.utcnow(),
    )
    await db.payments.insert_one(payment.dict())
    return payment
```

### Kafka consumer with retry

```python
@app.on_event("startup")
async def start_consumer():
    consumer = AIOKafkaConsumer(
        "ticketflow.payment.requested",
        bootstrap_servers=settings.kafka_bootstrap_servers,
        group_id="payment-service",
        enable_auto_commit=False,
    )
    await consumer.start()
    asyncio.create_task(consume_loop(consumer))

async def consume_loop(consumer):
    async for msg in consumer:
        try:
            event = PaymentRequestedEvent.model_validate_json(msg.value)
            payment = await process_payment(event)
            await publish_payment_processed(payment)
            await consumer.commit()
        except Exception as e:
            logger.error(f"Failed to process payment message: {e}", exc_info=True)
            # Do not commit — message will be redelivered
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Listening port | `3005` |
| `MONGODB_URL` | MongoDB connection string | `mongodb://ticketflow:pass@mongodb:27017/ticketflow_payments` |
| `KAFKA_BOOTSTRAP_SERVERS` | Kafka broker | `kafka:9092` |
| `STRIPE_SECRET_KEY` | Stripe API secret key | — |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | — |

---

## Local Development

```bash
cd services/payment-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 3005
```

For testing without a real Stripe key, set `STRIPE_SECRET_KEY=sk_test_...` and use Stripe test tokens (`tok_visa`, `tok_chargeDeclined`).

---

## Docker Build

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
EXPOSE 3005
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3005"]
```
