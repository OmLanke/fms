import logging
from datetime import datetime
from typing import Optional
from fastapi import HTTPException

from app.models.event import EventDocument, VenueDocument
from app.schemas.event import (
    EventCreate,
    EventUpdate,
    VenueCreate,
    EventListResponse,
    EventResponse,
    VenueResponse,
)
from app.kafka.producer import publish_event_created

logger = logging.getLogger(__name__)


async def list_events(
    page: int = 1, limit: int = 10, search: Optional[str] = None
) -> EventListResponse:
    query = {}
    if search:
        query = {
            "$or": [
                {"name": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}},
                {"tags": {"$in": [search]}},
            ]
        }

    total = await EventDocument.find(query).count()
    skip = (page - 1) * limit
    events = await EventDocument.find(query).skip(skip).limit(limit).to_list()

    return EventListResponse(
        events=[_to_event_response(e) for e in events],
        total=total,
        page=page,
        limit=limit,
    )


async def get_event(event_id: str) -> EventDocument:
    event = await EventDocument.find_one(EventDocument.id == event_id)
    if not event:
        raise HTTPException(
            status_code=404,
            detail={
                "error": {
                    "code": "EVENT_NOT_FOUND",
                    "message": f"Event {event_id} not found",
                }
            },
        )
    return event


async def create_event(data: EventCreate) -> EventDocument:
    # Fetch venue snapshot
    venue = await VenueDocument.find_one(VenueDocument.id == data.venue_id)
    venue_snapshot = None
    if venue:
        venue_snapshot = {
            "id": venue.id,
            "name": venue.name,
            "address": venue.address,
            "city": venue.city,
            "country": venue.country,
            "capacity": venue.capacity,
        }

    event = EventDocument(
        name=data.name,
        description=data.description,
        venue_id=data.venue_id,
        venue=venue_snapshot,
        date=data.date,
        price=data.price,
        total_seats=data.total_seats,
        available_seats=data.total_seats,
        image_url=data.image_url,
        tags=data.tags,
    )
    await event.insert()
    logger.info(f"Created event {event.id}: {event.name}")

    try:
        await publish_event_created(event.id, event.name, event.total_seats)
    except Exception as e:
        logger.warning(f"Failed to publish event.created for {event.id}: {e}")

    return event


async def update_event(event_id: str, data: EventUpdate) -> EventDocument:
    event = await get_event(event_id)
    update_data = data.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(event, key, value)
    event.updated_at = datetime.utcnow()
    await event.save()
    logger.info(f"Updated event {event_id}")
    return event


async def create_venue(data: VenueCreate) -> VenueDocument:
    venue = VenueDocument(
        name=data.name,
        address=data.address,
        city=data.city,
        country=data.country,
        capacity=data.capacity,
    )
    await venue.insert()
    logger.info(f"Created venue {venue.id}: {venue.name}")
    return venue


async def get_venue(venue_id: str) -> VenueDocument:
    venue = await VenueDocument.find_one(VenueDocument.id == venue_id)
    if not venue:
        raise HTTPException(
            status_code=404,
            detail={
                "error": {
                    "code": "VENUE_NOT_FOUND",
                    "message": f"Venue {venue_id} not found",
                }
            },
        )
    return venue


def _to_event_response(event: EventDocument) -> EventResponse:
    return EventResponse(
        id=event.id,
        name=event.name,
        description=event.description,
        venue_id=event.venue_id,
        venue=event.venue,
        date=event.date,
        price=event.price,
        total_seats=event.total_seats,
        available_seats=event.available_seats,
        image_url=event.image_url,
        tags=event.tags,
        created_at=event.created_at,
    )
