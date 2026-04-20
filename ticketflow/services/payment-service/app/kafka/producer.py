import json
import logging
from datetime import datetime
from aiokafka import AIOKafkaProducer
from app.config import settings

logger = logging.getLogger(__name__)
producer: AIOKafkaProducer = None


async def start_producer():
    global producer
    producer = AIOKafkaProducer(
        bootstrap_servers=settings.kafka_bootstrap_servers,
        value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        key_serializer=lambda k: k.encode("utf-8") if k else None,
    )
    await producer.start()
    logger.info("Kafka producer started")


async def stop_producer():
    global producer
    if producer:
        await producer.stop()


async def publish_payment_processed(
    booking_id: str,
    payment_id: str,
    status: str,
    reason: str = None,
):
    if not producer:
        logger.warning("Producer not initialized; skipping publish_payment_processed")
        return
    payload = {
        "eventType": "payment.processed",
        "bookingId": booking_id,
        "paymentId": payment_id,
        "status": status,
        "timestamp": datetime.utcnow().isoformat(),
    }
    if reason:
        payload["reason"] = reason
    await producer.send_and_wait(
        "ticketflow.payment.processed", value=payload, key=booking_id
    )
    logger.info(f"Published payment.processed for booking {booking_id} status={status}")
