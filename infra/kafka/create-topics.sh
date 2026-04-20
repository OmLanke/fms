#!/usr/bin/env bash
# TicketFlow Kafka Topic Initialization
# Run this script after Kafka starts to create all required topics

set -e

KAFKA_BROKER="${KAFKA_BROKER:-localhost:9092}"
PARTITIONS="${PARTITIONS:-3}"
REPLICATION_FACTOR="${REPLICATION_FACTOR:-1}"
RETENTION_MS="${RETENTION_MS:-604800000}" # 7 days

KAFKA_TOPICS=(
  "ticketflow.user.registered"
  "ticketflow.event.created"
  "ticketflow.booking.initiated"
  "ticketflow.seats.locked"
  "ticketflow.seats.lock-failed"
  "ticketflow.seats.confirm"
  "ticketflow.seats.release"
  "ticketflow.payment.requested"
  "ticketflow.payment.processed"
  "ticketflow.booking.confirmed"
  "ticketflow.booking.failed"
  "ticketflow.booking.cancelled"
)

# Dead-letter topics (DLT) for consumer retry failures
DLT_TOPICS=(
  "ticketflow.booking.initiated.DLT"
  "ticketflow.payment.requested.DLT"
  "ticketflow.booking.confirmed.DLT"
  "ticketflow.booking.failed.DLT"
)

echo "Waiting for Kafka to be ready at ${KAFKA_BROKER}..."
until kafka-topics.sh --bootstrap-server "${KAFKA_BROKER}" --list &>/dev/null 2>&1; do
  echo "  Kafka not ready yet, retrying in 3s..."
  sleep 3
done
echo "Kafka is ready!"

echo ""
echo "Creating main topics..."
for TOPIC in "${KAFKA_TOPICS[@]}"; do
  if kafka-topics.sh --bootstrap-server "${KAFKA_BROKER}" --describe --topic "${TOPIC}" &>/dev/null 2>&1; then
    echo "  [SKIP]   ${TOPIC} (already exists)"
  else
    kafka-topics.sh --bootstrap-server "${KAFKA_BROKER}" \
      --create \
      --topic "${TOPIC}" \
      --partitions "${PARTITIONS}" \
      --replication-factor "${REPLICATION_FACTOR}" \
      --config "retention.ms=${RETENTION_MS}" \
      --config "compression.type=snappy"
    echo "  [CREATE] ${TOPIC}"
  fi
done

echo ""
echo "Creating dead-letter topics..."
for TOPIC in "${DLT_TOPICS[@]}"; do
  if kafka-topics.sh --bootstrap-server "${KAFKA_BROKER}" --describe --topic "${TOPIC}" &>/dev/null 2>&1; then
    echo "  [SKIP]   ${TOPIC} (already exists)"
  else
    kafka-topics.sh --bootstrap-server "${KAFKA_BROKER}" \
      --create \
      --topic "${TOPIC}" \
      --partitions 1 \
      --replication-factor "${REPLICATION_FACTOR}" \
      --config "retention.ms=2592000000" # 30 days for DLT
    echo "  [CREATE] ${TOPIC}"
  fi
done

echo ""
echo "Topic creation complete. Listing all TicketFlow topics:"
kafka-topics.sh --bootstrap-server "${KAFKA_BROKER}" --list | grep "ticketflow"
