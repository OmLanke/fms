# Event Service

## Responsibility

The Event Service is the authority on all ticketed events and venues. It manages:

- Creating and updating events (admin only)
- Creating and managing venues
- Serving event listings and details to the frontend
- Publishing `event.created` Kafka events

---

## Technology Stack

| Component | Technology |
|---|---|
| Runtime | Python 3.12 |
| Framework | FastAPI |
| Language | Python |
| Database | MongoDB 7 |
| ODM | Motor (async MongoDB driver) + Pydantic |
| Kafka | confluent-kafka-python |
| Metrics | prometheus-client |
| Tracing | OpenTelemetry + opentelemetry-instrumentation-fastapi |
| Auto docs | FastAPI → OpenAPI 3.1 (at `/docs`) |

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/events` | No | List upcoming events |
| GET | `/events/{id}` | No | Get event details |
| POST | `/events` | Yes (ADMIN) | Create event |
| PUT | `/events/{id}` | Yes (ADMIN) | Update event |
| POST | `/venues` | Yes (ADMIN) | Create venue |
| GET | `/venues/{id}` | No | Get venue details |
| GET | `/health` | No | Health check |
| GET | `/metrics` | No | Prometheus metrics |

---

## Database Schema (MongoDB Collections)

### `events` collection

```javascript
{
  _id: ObjectId,
  id: String,            // ULID — used as public ID
  name: String,
  description: String,
  venueId: String,
  startsAt: Date,
  endsAt: Date,
  status: String,        // DRAFT | PUBLISHED | CANCELLED
  ticketTiers: [
    {
      tier: String,      // GENERAL | VIP | STANDING
      price: Number,     // minor currency units
      currency: String,  // ISO 4217
      capacity: Number
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:
- `{ startsAt: 1, status: 1 }` — for listing upcoming published events
- `{ venueId: 1 }` — for filtering by venue

### `venues` collection

```javascript
{
  _id: ObjectId,
  id: String,
  name: String,
  address: String,
  city: String,
  country: String,       // ISO 3166-1 alpha-2
  capacity: Number,
  createdAt: Date
}
```

Indexes:
- `{ city: 1 }` — for location-based browsing

---

## Kafka Topics

| Action | Topic | Direction |
|---|---|---|
| Event created | `ticketflow.event.created` | Produced |

---

## Key Business Logic

### Pydantic models (request validation)

```python
class CreateEventRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    venueId: str
    startsAt: datetime
    endsAt: datetime
    ticketTiers: list[TicketTier] = Field(min_length=1)

    @model_validator(mode='after')
    def ends_after_starts(self) -> 'CreateEventRequest':
        if self.endsAt <= self.startsAt:
            raise ValueError('endsAt must be after startsAt')
        return self
```

### Async MongoDB queries

```python
async def list_upcoming_events(page: int, per_page: int) -> list[Event]:
    cursor = db.events.find(
        {"status": "PUBLISHED", "startsAt": {"$gte": datetime.utcnow()}},
        sort=[("startsAt", ASCENDING)]
    ).skip((page - 1) * per_page).limit(per_page)
    return [Event(**doc) async for doc in cursor]
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Listening port | `3002` |
| `MONGODB_URL` | MongoDB connection string | `mongodb://ticketflow:pass@mongodb:27017/ticketflow_events` |
| `KAFKA_BOOTSTRAP_SERVERS` | Kafka broker | `kafka:9092` |
| `LOG_LEVEL` | Log level | `info` |
| `OTEL_EXPORTER_JAEGER_ENDPOINT` | Jaeger endpoint | `http://jaeger:14268/api/traces` |

---

## Local Development

```bash
cd services/event-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 3002
# OpenAPI docs: http://localhost:3002/docs
```

---

## Docker Build

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
EXPOSE 3002
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3002"]
```
