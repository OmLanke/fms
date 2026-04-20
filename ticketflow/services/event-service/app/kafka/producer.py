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


async def publish_event_created(event_id: str, name: str, total_seats: int):
    if not producer:
        return
    payload = {
        "eventType": "event.created",
        "eventId": event_id,
        "name": name,
        "totalSeats": total_seats,
        "timestamp": datetime.utcnow().isoformat(),
    }
    await producer.send_and_wait(
        "ticketflow.event.created", value=payload, key=event_id
    )
    logger.info(f"Published event.created for event {event_id}")
