from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime
import uuid


class NotificationDocument(Document):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # BOOKING_CONFIRMED | BOOKING_FAILED | WELCOME
    recipient_email: str
    subject: str
    body: str  # HTML
    status: str  # SENT | FAILED
    error: Optional[str] = None
    metadata: dict = {}
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "notifications"
