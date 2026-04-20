import logging
import random
import uuid
from datetime import datetime
from typing import Optional
from fastapi import HTTPException

from app.config import settings
from app.models.payment import PaymentDocument

logger = logging.getLogger(__name__)


async def process_payment(
    booking_id: str,
    user_id: str,
    amount: float,
    currency: str = "USD",
) -> PaymentDocument:
    payment = PaymentDocument(
        booking_id=booking_id,
        user_id=user_id,
        amount=amount,
        currency=currency,
        status="PENDING",
    )
    await payment.insert()
    logger.info(f"Created PENDING payment {payment.id} for booking {booking_id}")

    # Simulate payment processing
    await _simulate_payment(payment)
    return payment


async def _simulate_payment(payment: PaymentDocument):
    success = random.random() < settings.payment_success_rate
    payment.provider_ref = f"mock-txn-{uuid.uuid4().hex[:12].upper()}"
    payment.updated_at = datetime.utcnow()

    if success:
        payment.status = "SUCCESS"
        logger.info(f"Payment {payment.id} succeeded (ref={payment.provider_ref})")
    else:
        payment.status = "FAILED"
        payment.reason = "Payment declined by mock provider"
        logger.warning(f"Payment {payment.id} failed for booking {payment.booking_id}")

    await payment.save()


async def get_payment(payment_id: str) -> PaymentDocument:
    payment = await PaymentDocument.find_one(PaymentDocument.id == payment_id)
    if not payment:
        raise HTTPException(
            status_code=404,
            detail={
                "error": {
                    "code": "PAYMENT_NOT_FOUND",
                    "message": f"Payment {payment_id} not found",
                }
            },
        )
    return payment


async def get_payment_by_booking(booking_id: str) -> Optional[PaymentDocument]:
    payment = await PaymentDocument.find_one(PaymentDocument.booking_id == booking_id)
    if not payment:
        raise HTTPException(
            status_code=404,
            detail={
                "error": {
                    "code": "PAYMENT_NOT_FOUND",
                    "message": f"No payment found for booking {booking_id}",
                }
            },
        )
    return payment
