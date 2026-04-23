import logging
from fastapi import APIRouter
from pydantic import BaseModel
from app.services.payment_service import (
    get_payment,
    get_payment_by_booking,
    process_payment,
    create_razorpay_order,
    verify_razorpay_payment
)
from app.config import settings
from app.kafka.producer import publish_payment_processed

logger = logging.getLogger(__name__)
router = APIRouter()

class CreateOrderRequest(BaseModel):
    booking_id: str
    user_id: str
    amount: float
    currency: str = "INR"

class VerifyPaymentRequest(BaseModel):
    payment_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    signature: str

@router.get("/health")
async def health():
    return {"status": "up", "service": "payment-service"}

@router.post("/api/payments/create-order")
async def create_order(request: CreateOrderRequest):
    # 1. Create initial PENDING payment record
    payment = await process_payment(
        booking_id=request.booking_id,
        user_id=request.user_id,
        amount=request.amount,
        currency=request.currency
    )

    # 2. Create Razorpay order
    order = await create_razorpay_order(payment)

    return {
        "payment_id": payment.id,
        "order_id": order["id"],
        "amount": order["amount"],
        "currency": order["currency"],
        "razorpay_key_id": settings.razorpay_key_id
    }

@router.post("/api/payments/verify")
async def verify_payment(request: VerifyPaymentRequest):
    payment = await verify_razorpay_payment(
        payment_id=request.payment_id,
        razorpay_order_id=request.razorpay_order_id,
        razorpay_payment_id=request.razorpay_payment_id,
        signature=request.signature
    )

    await publish_payment_processed(
        booking_id=payment.booking_id,
        payment_id=payment.id,
        status=payment.status,
        reason=payment.reason,
    )

    return {
        "id": payment.id,
        "status": payment.status,
        "providerRef": payment.provider_ref,
        "updatedAt": payment.updated_at.isoformat()
    }

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
