from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class VenueCreate(BaseModel):
    name: str
    address: str
    city: str
    country: str
    capacity: int


class VenueResponse(BaseModel):
    id: str
    name: str
    address: str
    city: str
    country: str
    capacity: int


class EventCreate(BaseModel):
    name: str
    description: str
    venue_id: str
    date: datetime
    price: float
    total_seats: int
    image_url: Optional[str] = None
    tags: list[str] = []


class EventUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    venue_id: Optional[str] = None
    date: Optional[datetime] = None
    price: Optional[float] = None
    total_seats: Optional[int] = None
    available_seats: Optional[int] = None
    image_url: Optional[str] = None
    tags: Optional[list[str]] = None


class EventResponse(BaseModel):
    id: str
    name: str
    description: str
    venue_id: str
    venue: Optional[dict] = None
    date: datetime
    price: float
    total_seats: int
    available_seats: int
    image_url: Optional[str] = None
    tags: list[str] = []
    created_at: datetime


class EventListResponse(BaseModel):
    events: list[EventResponse]
    total: int
    page: int
    limit: int
