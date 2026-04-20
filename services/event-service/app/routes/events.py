import logging
from typing import Optional
from fastapi import APIRouter, Header, HTTPException, Query, status
from fastapi.responses import JSONResponse

from app.schemas.event import (
    EventCreate,
    EventUpdate,
    EventResponse,
    EventListResponse,
    VenueCreate,
    VenueResponse,
)
from app.services import event_service
from app.models.event import VenueDocument

logger = logging.getLogger(__name__)
router = APIRouter()


def _require_admin(x_user_role: Optional[str]):
    if x_user_role != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail={"error": {"code": "FORBIDDEN", "message": "Admin role required"}},
        )


@router.get("/health")
async def health():
    return {"status": "up", "service": "event-service"}


@router.get("/api/events", response_model=EventListResponse)
async def list_events(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None),
):
    return await event_service.list_events(page=page, limit=limit, search=search)


@router.get("/api/events/{event_id}", response_model=EventResponse)
async def get_event(event_id: str):
    event = await event_service.get_event(event_id)
    return event_service._to_event_response(event)


@router.post(
    "/api/events", response_model=EventResponse, status_code=status.HTTP_201_CREATED
)
async def create_event(
    data: EventCreate,
    x_user_role: Optional[str] = Header(None),
):
    _require_admin(x_user_role)
    event = await event_service.create_event(data)
    return event_service._to_event_response(event)


@router.put("/api/events/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: str,
    data: EventUpdate,
    x_user_role: Optional[str] = Header(None),
):
    _require_admin(x_user_role)
    event = await event_service.update_event(event_id, data)
    return event_service._to_event_response(event)


@router.post(
    "/api/venues", response_model=VenueResponse, status_code=status.HTTP_201_CREATED
)
async def create_venue(
    data: VenueCreate,
    x_user_role: Optional[str] = Header(None),
):
    _require_admin(x_user_role)
    venue = await event_service.create_venue(data)
    return VenueResponse(
        id=venue.id,
        name=venue.name,
        address=venue.address,
        city=venue.city,
        country=venue.country,
        capacity=venue.capacity,
    )


@router.get("/api/venues/{venue_id}", response_model=VenueResponse)
async def get_venue(venue_id: str):
    venue = await event_service.get_venue(venue_id)
    return VenueResponse(
        id=venue.id,
        name=venue.name,
        address=venue.address,
        city=venue.city,
        country=venue.country,
        capacity=venue.capacity,
    )
