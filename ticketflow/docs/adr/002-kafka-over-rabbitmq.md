# ADR 002 — Apache Kafka over RabbitMQ

**Status:** Accepted  
**Date:** 2024-02-10  
**Deciders:** Platform Architecture Team

---

## Context

TicketFlow originally used **RabbitMQ** as its message broker. RabbitMQ was chosen for its simplicity: it is easy to set up, has a mature management UI, and works well for task queues.

As the booking saga grew in complexity, several limitations surfaced:

1. **No message replay** — Once a RabbitMQ message is acknowledged, it is gone. If a service is down when a message arrives and the message is not requeued, it is lost. In the booking saga, a lost `seats.locked` event means a payment is never requested and the booking silently stalls in PENDING.

2. **Consumer group semantics** — RabbitMQ supports competing consumers on a queue, but there is no native concept of a named consumer group that tracks per-consumer offset. Scaling a service means carefully managing exclusive subscriptions or exchange bindings.

3. **No native KEDA integration** — KEDA supports RabbitMQ via the queue depth metric, but the granularity is per-queue. Kafka's consumer group lag metric gives per-partition granularity, enabling more precise autoscaling.

4. **Message ordering** — RabbitMQ cannot guarantee ordered delivery to a competing consumer pool. Booking saga steps for the same booking must be processed in order; RabbitMQ requires application-level sequencing logic to achieve this.

5. **Audit trail** — The booking saga is a financial workflow. Regulators or support teams may need to reconstruct the exact sequence of events for a booking. RabbitMQ provides no durable log once messages are consumed.

---

## Decision

Replace RabbitMQ with **Apache Kafka** as the sole message broker for all asynchronous inter-service communication.

---

## Rationale

| Requirement | RabbitMQ | Kafka |
|---|---|---|
| Message replay after crash | No (unless manually requeued) | Yes (offset-based replay, configurable retention) |
| Consumer group with offset tracking | Limited | First-class: consumer group + committed offset |
| Per-partition ordering | No | Yes (partition key routes related events to same partition) |
| KEDA autoscaling precision | Queue depth (coarse) | Consumer group lag per partition (fine) |
| Durable audit log | No | Yes (configurable retention, default 7 days) |
| Exactly-once semantics | No | Yes (transactional producer + idempotent consumer) |
| Schema evolution support | Via plugins | Via header metadata + backward-compatible JSON |

### Event log replay

When the Inventory Service is redeployed it commits its current offset on startup. If it was offline during a burst of `booking.initiated` messages, it replays them from the last committed offset without requiring any special re-delivery mechanism. With RabbitMQ, this scenario required a separate retry queue and a dead-letter exchange with carefully tuned TTLs.

### Partition-based ordering

All saga events use `bookingId` as the Kafka partition key. Kafka guarantees that all messages with the same key go to the same partition, and all consumers process a partition sequentially. This means the Inventory Service always processes `booking.initiated` before `seats.confirm` for the same booking, without any application-level coordination.

### KEDA integration

KEDA's Kafka trigger scales service replicas based on consumer group lag:

```yaml
triggers:
  - type: kafka
    metadata:
      topic: ticketflow.booking.initiated
      consumerGroup: inventory-service
      lagThreshold: "50"
```

When 50+ unprocessed `booking.initiated` messages accumulate, KEDA adds Inventory Service pods. New pods join the same consumer group and Kafka automatically redistributes partitions. This is impossible to replicate with RabbitMQ without custom metrics.

---

## Consequences

### Positive

- Services can recover from crashes by replaying missed messages.
- Booking saga steps are processed in order per booking.
- Kafka topic is an immutable audit log for financial compliance.
- KEDA autoscaling reacts directly to processing backlog.
- Consumer group lag is a meaningful SLO metric.

### Negative

- **Operational complexity** — Kafka requires Zookeeper (or KRaft) and is more complex to operate than RabbitMQ. The management UI (Redpanda Console) is provided to mitigate this.
- **Higher resource usage** — Kafka brokers require more memory than RabbitMQ (minimum 1 GB heap per broker).
- **Learning curve** — Kafka concepts (partitions, consumer groups, offsets, lag) are unfamiliar to engineers used to traditional message queues.
- **Not appropriate for every use case** — For simple task queues (e.g. image processing jobs) RabbitMQ or a Redis list would be simpler. Kafka is justified here because of the saga pattern's ordering, replay, and auditability requirements.

### Migration notes

The migration from RabbitMQ to Kafka involved:

1. Replacing `amqplib` (Node.js) with `kafkajs` / Spring Kafka / `confluent-kafka-python`.
2. Redesigning the message schema to include `eventId`, `occurredAt`, and `eventType` fields (Kafka messages have no native routing envelope like AMQP).
3. Adding partition key logic (all saga events keyed by `bookingId`).
4. Updating Docker Compose and Kubernetes manifests.
5. Removing the RabbitMQ management plugin and related monitoring.
