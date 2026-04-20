from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime
import uuid


class VenueDocument(Document):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str
    city: str
    country: str
    capacity: int
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "venues"


class EventDocument(Document):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    venue_id: str
    venue: Optional[dict] = None  # embedded venue snapshot
    date: datetime
    price: float
    total_seats: int
    available_seats: int
    image_url: Optional[str] = None
    tags: list[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "events"
