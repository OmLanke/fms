"""
Seed script for Event Service.
Run with: python -m app.seed
"""

import asyncio
import json
import logging
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from aiokafka import AIOKafkaProducer

from app.config import settings
from app.models.event import VenueDocument, EventDocument

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)


async def seed():
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.mongodb_db]
    await init_beanie(database=db, document_models=[VenueDocument, EventDocument])

    # Clear existing seed data
    await VenueDocument.delete_all()
    await EventDocument.delete_all()
    logger.info("Cleared existing venues and events")

    # --- Venues ---
    msg = VenueDocument(
        name="Madison Square Garden",
        address="4 Pennsylvania Plaza",
        city="New York",
        country="US",
        capacity=20000,
    )
    o2 = VenueDocument(
        name="The O2 Arena",
        address="Peninsula Square",
        city="London",
        country="UK",
        capacity=20000,
    )
    soh = VenueDocument(
        name="Sydney Opera House",
        address="Bennelong Point",
        city="Sydney",
        country="AU",
        capacity=5000,
    )
    for v in (msg, o2, soh):
        await v.insert()
        logger.info(f"Created venue: {v.name} (id={v.id})")

    # --- Events ---
    events_data = [
        EventDocument(
            name="Rock Night Live",
            description="An electrifying rock concert featuring top bands from around the world.",
            venue_id=msg.id,
            venue={
                "id": msg.id,
                "name": msg.name,
                "address": msg.address,
                "city": msg.city,
                "country": msg.country,
                "capacity": msg.capacity,
            },
            date=datetime(2025, 6, 15, 20, 0, 0),
            price=75.0,
            total_seats=120,
            available_seats=120,
            tags=["rock", "live", "music"],
        ),
        EventDocument(
            name="Jazz & Blues Festival",
            description="A soulful evening celebrating the finest jazz and blues artists.",
            venue_id=o2.id,
            venue={
                "id": o2.id,
                "name": o2.name,
                "address": o2.address,
                "city": o2.city,
                "country": o2.country,
                "capacity": o2.capacity,
            },
            date=datetime(2025, 7, 20, 19, 0, 0),
            price=55.0,
            total_seats=100,
            available_seats=100,
            tags=["jazz", "blues", "festival"],
        ),
        EventDocument(
            name="Classical Symphony Evening",
            description="An intimate symphony performance in the iconic Sydney Opera House.",
            venue_id=soh.id,
            venue={
                "id": soh.id,
                "name": soh.name,
                "address": soh.address,
                "city": soh.city,
                "country": soh.country,
                "capacity": soh.capacity,
            },
            date=datetime(2025, 8, 10, 18, 30, 0),
            price=95.0,
            total_seats=80,
            available_seats=80,
            tags=["classical", "symphony", "orchestra"],
        ),
    ]
    for event in events_data:
        await event.insert()
        logger.info(f"Created event: {event.name} (id={event.id})")

    # --- Publish ticketflow.event.created for each event so inventory-service creates seats ---
    producer = AIOKafkaProducer(
        bootstrap_servers=settings.kafka_bootstrap_servers,
        value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        key_serializer=lambda k: k.encode("utf-8") if k else None,
    )
    await producer.start()
    try:
        for event in events_data:
            payload = {
                "eventType": "event.created",
                "eventId": str(event.id),
                "name": event.name,
                "totalSeats": event.total_seats,
                "timestamp": datetime.utcnow().isoformat(),
            }
            await producer.send_and_wait(
                "ticketflow.event.created",
                value=payload,
                key=str(event.id),
            )
            logger.info(
                f"Published event.created for: {event.name} (totalSeats={event.total_seats})"
            )
    finally:
        await producer.stop()

    logger.info("Seed complete.")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
