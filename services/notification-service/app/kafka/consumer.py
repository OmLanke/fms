import asyncio
import json
import logging
from aiokafka import AIOKafkaConsumer
from app.config import settings
from app.handlers.booking_confirmed import handle_booking_confirmed
from app.handlers.booking_failed import handle_booking_failed
from app.handlers.welcome import handle_welcome

logger = logging.getLogger(__name__)

TOPICS = [
    "ticketflow.booking.confirmed",
    "ticketflow.booking.failed",
    "ticketflow.user.registered",
]
GROUP_ID = "notification-service"
MAX_RETRIES = 3


async def _dispatch(event_type: str, data: dict):
    if event_type in ("booking.confirmed", "ticketflow.booking.confirmed"):
        await handle_booking_confirmed(data)
    elif event_type in ("booking.failed", "ticketflow.booking.failed"):
        await handle_booking_failed(data)
    elif event_type in ("user.registered", "ticketflow.user.registered"):
        await handle_welcome(data)
    else:
        logger.warning(f"Unknown eventType: {event_type}")


async def _handle_with_retry(data: dict):
    event_type = data.get("eventType", "")
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            await _dispatch(event_type, data)
            return
        except Exception as e:
            if attempt == MAX_RETRIES:
                logger.error(
                    f"[DLQ] Failed to process event after {MAX_RETRIES} attempts. "
                    f"eventType={event_type} error={e} payload={data}",
                    exc_info=True,
                )
            else:
                logger.warning(
                    f"Attempt {attempt}/{MAX_RETRIES} failed for eventType={event_type}: {e}. Retrying…"
                )
                await asyncio.sleep(attempt * 1.0)


async def consume_loop():
    backoff = 1
    while True:
        consumer = None
        try:
            consumer = AIOKafkaConsumer(
                *TOPICS,
                bootstrap_servers=settings.kafka_bootstrap_servers,
                group_id=GROUP_ID,
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                auto_offset_reset="earliest",
                enable_auto_commit=True,
            )
            await consumer.start()
            logger.info(f"Notification consumer started, topics={TOPICS}")
            backoff = 1

            async for msg in consumer:
                logger.debug(f"Received message from {msg.topic}: {msg.value}")
                await _handle_with_retry(msg.value)

        except asyncio.CancelledError:
            logger.info("Notification consumer task cancelled")
            break
        except Exception as e:
            logger.error(
                f"Consumer error: {e}. Reconnecting in {backoff}s…", exc_info=True
            )
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60)
        finally:
            if consumer:
                try:
                    await consumer.stop()
                except Exception:
                    pass


async def start_consumer():
    task = asyncio.create_task(consume_loop())
    return task
