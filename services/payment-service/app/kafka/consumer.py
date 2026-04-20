import asyncio
import json
import logging
from aiokafka import AIOKafkaConsumer
from app.config import settings
from app.services.payment_service import process_payment
from app.kafka.producer import publish_payment_processed

logger = logging.getLogger(__name__)

TOPIC = "ticketflow.payment.requested"
GROUP_ID = "payment-service"


async def consume_loop():
    backoff = 1
    while True:
        consumer = None
        try:
            consumer = AIOKafkaConsumer(
                TOPIC,
                bootstrap_servers=settings.kafka_bootstrap_servers,
                group_id=GROUP_ID,
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                auto_offset_reset="earliest",
                enable_auto_commit=True,
            )
            await consumer.start()
            logger.info(f"Kafka consumer started, listening on {TOPIC}")
            backoff = 1  # reset on successful connect

            async for msg in consumer:
                await handle_message(msg.value)

        except asyncio.CancelledError:
            logger.info("Payment consumer task cancelled")
            break
        except Exception as e:
            logger.error(f"Consumer error: {e}. Retrying in {backoff}s…", exc_info=True)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60)
        finally:
            if consumer:
                try:
                    await consumer.stop()
                except Exception:
                    pass


async def handle_message(data: dict):
    booking_id = data.get("bookingId")
    user_id = data.get("userId")
    amount = data.get("amount")
    currency = data.get("currency", "USD")

    if not booking_id or not user_id or amount is None:
        logger.warning(f"Received malformed payment.requested message: {data}")
        return

    logger.info(
        f"Processing payment for booking {booking_id}, amount={amount} {currency}"
    )
    try:
        payment = await process_payment(
            booking_id=booking_id,
            user_id=user_id,
            amount=amount,
            currency=currency,
        )
        await publish_payment_processed(
            booking_id=booking_id,
            payment_id=payment.id,
            status=payment.status,
            reason=payment.reason,
        )
    except Exception as e:
        logger.error(
            f"Failed to process payment for booking {booking_id}: {e}", exc_info=True
        )
        await publish_payment_processed(
            booking_id=booking_id,
            payment_id="unknown",
            status="FAILED",
            reason=str(e),
        )


async def start_consumer():
    task = asyncio.create_task(consume_loop())
    return task
