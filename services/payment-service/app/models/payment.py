from beanie import Document, Indexed
from pydantic import Field
from typing import Optional
from datetime import datetime
import uuid


class PaymentDocument(Document):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    booking_id: str
    user_id: str
    amount: float
    currency: str = "INR"
    status: str = "PENDING"  # PENDING | SUCCESS | FAILED
    reason: Optional[str] = None
    provider_ref: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "payments"
        indexes = ["booking_id"]
