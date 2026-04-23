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
            name="Dhurandar 2",
            description="Hamza Ali Mazari pursues Major Iqbal to dismantle Pakistan's crime system. As his mission unfolds, his past reveals a transformative history that shaped his relentless drive for justice.",
            image_url="/src/assets/dhurandar2.png",
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
            name="Hangover",
            description="Three buddies wake up from a bachelor party in Las Vegas with no memory of the previous night and the bachelor missing. They must make their way around the city in order to find their friend in time for his wedding.",
            image_url="/src/assets/hangover.jpg",
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
            name="Bean",
            description="Mr. Bean is a well-meaning yet clumsy and destructive security guard at the National Gallery in London. After the gallery's sentimental chairman prevents the board of directors, who despise Bean for his laziness, from firing him, the board instead opts to send Bean on a three-month sabbatical to serve as their representative.",
            image_url="/src/assets/mrbean.jpg",
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
