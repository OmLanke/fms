import logging
from fastapi import APIRouter
from app.services.payment_service import get_payment, get_payment_by_booking

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "up", "service": "payment-service"}


@router.get("/api/payments/{payment_id}")
async def fetch_payment(payment_id: str):
    payment = await get_payment(payment_id)
    return {
        "id": payment.id,
        "bookingId": payment.booking_id,
        "userId": payment.user_id,
        "amount": payment.amount,
        "currency": payment.currency,
        "status": payment.status,
        "reason": payment.reason,
        "providerRef": payment.provider_ref,
        "createdAt": payment.created_at.isoformat(),
        "updatedAt": payment.updated_at.isoformat(),
    }


@router.get("/api/payments/booking/{booking_id}")
async def fetch_payment_by_booking(booking_id: str):
    payment = await get_payment_by_booking(booking_id)
    return {
        "id": payment.id,
        "bookingId": payment.booking_id,
        "userId": payment.user_id,
        "amount": payment.amount,
        "currency": payment.currency,
        "status": payment.status,
        "reason": payment.reason,
        "providerRef": payment.provider_ref,
        "createdAt": payment.created_at.isoformat(),
        "updatedAt": payment.updated_at.isoformat(),
    }
