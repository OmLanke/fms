# Observability Guide

TicketFlow ships with a complete observability stack: Prometheus for metrics, Grafana for dashboards, Jaeger for distributed tracing, and Loki + Promtail for log aggregation.

## Table of Contents

- [Metrics with Prometheus](#metrics-with-prometheus)
- [Dashboards with Grafana](#dashboards-with-grafana)
- [Distributed Tracing with Jaeger](#distributed-tracing-with-jaeger)
- [Log Aggregation with Loki](#log-aggregation-with-loki)
- [Alerting](#alerting)

---

## Metrics with Prometheus

### Access

- **URL:** http://localhost:9090

### What is scraped

Prometheus is configured in `infra/prometheus/prometheus.yml` to scrape all application services:

```yaml
scrape_configs:
  - job_name: gateway
    static_configs:
      - targets: ['gateway:3000']
    metrics_path: /metrics

  - job_name: user-service
    static_configs:
      - targets: ['user-service:3001']
    metrics_path: /actuator/prometheus

  - job_name: event-service
    static_configs:
      - targets: ['event-service:3002']
    metrics_path: /metrics

  - job_name: booking-service
    static_configs:
      - targets: ['booking-service:3003']
    metrics_path: /actuator/prometheus

  - job_name: inventory-service
    static_configs:
      - targets: ['inventory-service:3004']
    metrics_path: /metrics

  - job_name: payment-service
    static_configs:
      - targets: ['payment-service:3005']
    metrics_path: /metrics

  - job_name: notification-service
    static_configs:
      - targets: ['notification-service:3006']
    metrics_path: /metrics

  - job_name: kafka
    static_configs:
      - targets: ['kafka-exporter:9308']
```

### Key metrics per service

#### API Gateway

| Metric | Description |
|---|---|
| `http_requests_total{service="gateway"}` | Request count by method, path, status |
| `http_request_duration_seconds` | Request latency histogram |
| `gateway_upstream_errors_total` | Upstream service errors |

#### User Service (Spring Boot — Micrometer)

| Metric | Description |
|---|---|
| `http_server_requests_seconds` | Request latency by endpoint |
| `jvm_memory_used_bytes` | JVM heap and non-heap usage |
| `jvm_gc_pause_seconds` | GC pause duration |
| `hikaricp_connections_active` | Active DB connection pool connections |

#### Booking Service (Spring Boot — Micrometer)

| Metric | Description |
|---|---|
| `booking_saga_initiated_total` | Sagas started |
| `booking_saga_confirmed_total` | Sagas completed successfully |
| `booking_saga_failed_total` | Sagas failed |
| `booking_saga_duration_seconds` | End-to-end saga latency |
| `kafka_consumer_lag` | Consumer group lag |

#### Inventory Service (Bun — custom Prometheus client)

| Metric | Description |
|---|---|
| `seat_lock_operations_total{result="success|failure"}` | Lock attempt outcomes |
| `seat_lock_duration_ms` | Time to acquire all locks for a booking |
| `redis_operations_total` | Redis operation count |
| `redis_operation_duration_ms` | Redis operation latency |

#### Payment Service (Python — prometheus-client)

| Metric | Description |
|---|---|
| `payment_processed_total{status="success|failure"}` | Payment outcomes |
| `payment_processing_duration_seconds` | Time to process a payment |
| `stripe_api_errors_total` | Stripe API error count |

### Adding custom metrics

**Python (FastAPI):**

```python
from prometheus_client import Counter, Histogram

PAYMENTS_PROCESSED = Counter(
    'payment_processed_total',
    'Total payments processed',
    ['status']
)
PAYMENT_DURATION = Histogram(
    'payment_processing_duration_seconds',
    'Payment processing duration'
)

# Usage:
with PAYMENT_DURATION.time():
    result = await process_payment(payload)
PAYMENTS_PROCESSED.labels(status=result.status).inc()
```

**Java (Spring Boot + Micrometer):**

```java
@Autowired
private MeterRegistry meterRegistry;

Counter bookingConfirmed = Counter.builder("booking_saga_confirmed_total")
    .description("Confirmed bookings")
    .register(meterRegistry);

bookingConfirmed.increment();
```

**TypeScript (Bun + prom-client):**

```typescript
import { Counter } from 'prom-client';

const lockAttempts = new Counter({
  name: 'seat_lock_operations_total',
  help: 'Seat lock operation outcomes',
  labelNames: ['result'],
});

lockAttempts.labels({ result: 'success' }).inc();
```

---

## Dashboards with Grafana

### Access

- **URL:** http://localhost:3010
- **Credentials:** admin / admin (change on first login)

### Pre-built dashboards

Located in `infra/grafana/dashboards/`:

| Dashboard | File | Description |
|---|---|---|
| Platform Overview | `overview.json` | Request rate, error rate, p99 latency across all services |
| Booking Saga | `booking-saga.json` | Saga throughput, step latencies, success/failure rates |
| Kafka Consumer Lag | `kafka.json` | Lag per consumer group per topic |
| JVM Health | `jvm.json` | Heap, GC, threads for Java services |
| Python Services | `python.json` | Memory, CPU, event loop lag for Python services |
| Seat Inventory | `inventory.json` | Lock rates, Redis ops/sec, availability trends |

### Key panels in the Booking Saga dashboard

1. **Saga Throughput** — rate of bookings initiated vs confirmed vs failed.
2. **Step Latency Breakdown** — time spent in each saga step (seat lock, payment, confirmation).
3. **Consumer Lag Heatmap** — per-partition lag across all saga topics.
4. **DLT Message Rate** — messages forwarded to dead-letter topics (should be zero in normal operation).
5. **Redis Lock Duration p95** — 95th percentile seat lock acquisition time.

---

## Distributed Tracing with Jaeger

### Access

- **URL:** http://localhost:16686

### How tracing works

All services are instrumented with OpenTelemetry. A unique `traceId` is generated by the gateway for each inbound request and propagated:

1. **HTTP requests** — via standard W3C `traceparent` header.
2. **Kafka messages** — via a `traceparent` Kafka header included in every produced message.

This means a single booking request produces a trace that spans:

```
gateway [POST /api/bookings]
  └── booking-service [POST /internal/bookings]
        └── kafka produce [booking.initiated]
              └── inventory-service [consume booking.initiated]
                    └── redis [SETNX seat:*]
                    └── postgres [UPDATE seats]
                    └── kafka produce [seats.locked]
                          └── booking-service [consume seats.locked]
                                └── kafka produce [payment.requested]
                                      └── payment-service [consume payment.requested]
                                            └── stripe [charges.create]
                                            └── mongodb [insert payment]
                                            └── kafka produce [payment.processed]
                                                  └── booking-service [consume payment.processed]
                                                        └── postgres [UPDATE bookings]
                                                        └── kafka produce [booking.confirmed]
                                                              └── notification-service [consume booking.confirmed]
                                                                    └── smtp [send email]
```

### Tracing a booking end-to-end

1. Initiate a booking and capture the `bookingId`.
2. Open Jaeger UI at http://localhost:16686.
3. In the search panel:
   - **Service:** `gateway`
   - **Operation:** `POST /api/bookings`
   - **Tags:** `bookingId=bkg_01HZ3ABC`
4. Click the trace to see the full waterfall.

### OpenTelemetry configuration

**Java (Spring Boot):**

Add to `application.yml`:

```yaml
management:
  tracing:
    sampling:
      probability: 1.0
spring:
  application:
    name: booking-service
```

Set environment variable:

```
OTEL_EXPORTER_JAEGER_ENDPOINT=http://jaeger:14268/api/traces
```

**Python (FastAPI):**

```python
from opentelemetry import trace
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.kafka import KafkaInstrumentor

tracer_provider = TracerProvider()
jaeger_exporter = JaegerExporter(collector_endpoint=os.getenv("OTEL_EXPORTER_JAEGER_ENDPOINT"))
tracer_provider.add_span_processor(BatchSpanProcessor(jaeger_exporter))
trace.set_tracer_provider(tracer_provider)

FastAPIInstrumentor.instrument_app(app)
KafkaInstrumentor().instrument()
```

**TypeScript (Bun):**

```typescript
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

const provider = new NodeTracerProvider();
provider.addSpanProcessor(
  new BatchSpanProcessor(new JaegerExporter({
    endpoint: process.env.OTEL_EXPORTER_JAEGER_ENDPOINT,
  }))
);
provider.register();
```

---

## Log Aggregation with Loki

### Access

Loki is queried through Grafana Explore: http://localhost:3010/explore

Select **Loki** as the data source.

### Log format

All services emit structured JSON logs:

```json
{
  "timestamp": "2024-06-15T14:22:01.234Z",
  "level": "INFO",
  "service": "booking-service",
  "traceId": "7f3c2a1b4d5e6f7a",
  "spanId": "1a2b3c4d",
  "bookingId": "bkg_01HZ3ABC",
  "message": "Booking confirmed",
  "duration_ms": 4231
}
```

### Promtail configuration

Promtail is configured in `infra/loki/promtail.yml` to collect Docker container logs and label them by service name:

```yaml
scrape_configs:
  - job_name: containers
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        target_label: service
```

### Useful LogQL queries

```logql
# All errors across all services
{job="containers"} |= "ERROR"

# Booking saga errors for a specific booking
{service="booking-service"} |= "bkg_01HZ3ABC" | json | level = "ERROR"

# Payment failures in the last hour
{service="payment-service"} | json | status = "FAILED"

# Slow requests (over 2 seconds)
{service="gateway"} | json | duration_ms > 2000

# DLT messages forwarded
{job="containers"} |= "DeadLetterPublishing"

# Count errors per service (metric query)
sum by (service) (rate({job="containers"} |= "ERROR" [5m]))
```

---

## Alerting

Alert rules are defined in `infra/prometheus/alerts.yml` and loaded automatically.

### Example alert rules

```yaml
groups:
  - name: ticketflow
    rules:

      - alert: HighBookingFailureRate
        expr: |
          rate(booking_saga_failed_total[5m]) /
          rate(booking_saga_initiated_total[5m]) > 0.05
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High booking failure rate"
          description: "More than 5% of bookings are failing over the last 5 minutes."

      - alert: KafkaConsumerLagHigh
        expr: kafka_consumer_group_lag > 500
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Kafka consumer lag is high"
          description: "Consumer group {{ $labels.consumergroup }} has lag > 500 on topic {{ $labels.topic }}"

      - alert: DLTMessagesDetected
        expr: kafka_topic_partitions_current_offset{topic=~".*\\.DLT"} > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Dead-letter topic has messages"
          description: "Topic {{ $labels.topic }} has messages in the DLT. Manual investigation required."

      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service is down"
          description: "Service {{ $labels.job }} has been down for more than 1 minute."

      - alert: HighErrorRate
        expr: |
          rate(http_requests_total{status=~"5.."}[5m]) /
          rate(http_requests_total[5m]) > 0.01
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High HTTP error rate"
          description: "Service {{ $labels.service }} has > 1% 5xx error rate."

      - alert: PaymentServiceDown
        expr: up{job="payment-service"} == 0
        for: 30s
        labels:
          severity: critical
        annotations:
          summary: "Payment service is unreachable"
          description: "The payment service has been down for 30 seconds. Active sagas will stall."
```

### Grafana alert channels

Configure Grafana notification channels in the UI:
1. Go to **Alerting → Contact points**.
2. Add a Slack webhook, PagerDuty integration, or email.
3. Create a **Notification policy** that routes `critical` alerts to PagerDuty and `warning` alerts to Slack.
