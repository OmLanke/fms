import logging
import razorpay
from datetime import datetime
from typing import Optional
from fastapi import HTTPException

from app.config import settings
from app.models.payment import PaymentDocument

logger = logging.getLogger(__name__)

# Initialize Razorpay Client
client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))

async def process_payment(
    booking_id: str,
    user_id: str,
    amount: float,
    currency: str = "INR",
) -> PaymentDocument:
    existing_pending = await PaymentDocument.find_one(
        PaymentDocument.booking_id == booking_id,
        PaymentDocument.status == "PENDING",
    )
    if existing_pending:
        logger.info(
            f"Reusing existing PENDING payment {existing_pending.id} for booking {booking_id}"
        )
        return existing_pending

    payment = PaymentDocument(
        booking_id=booking_id,
        user_id=user_id,
        amount=amount,
        currency=currency,
        status="PENDING",
    )
    await payment.insert()
    logger.info(f"Created PENDING payment {payment.id} for booking {booking_id}")
    return payment

async def create_razorpay_order(payment: PaymentDocument) -> dict:
    try:
        # Razorpay expects amount in smallest currency unit (paise for INR)
        amount_in_paise = int(round(payment.amount * 100))

        if payment.provider_ref and payment.status == "PENDING":
            return {
                "id": payment.provider_ref,
                "amount": amount_in_paise,
                "currency": payment.currency,
            }

        order_data = {
            "receipt": payment.id,
            "amount": amount_in_paise,
            "currency": payment.currency,
            "payment_capture": "1"  # Auto capture
        }

        razorpay_order = client.order.create(data=order_data)

        payment.provider_ref = razorpay_order["id"]
        payment.updated_at = datetime.utcnow()
        await payment.save()

        logger.info(f"Razorpay order {razorpay_order['id']} created for payment {payment.id}")
        return razorpay_order

    except Exception as e:
        logger.error(f"Failed to create Razorpay order: {str(e)}")
        payment.status = "FAILED"
        payment.reason = f"Razorpay order creation failed: {str(e)}"
        await payment.save()
        raise HTTPException(status_code=500, detail="Failed to create payment order")

async def verify_razorpay_payment(
    payment_id: str,
    razorpay_order_id: str,
    razorpay_payment_id: str,
    signature: str
) -> PaymentDocument:
    payment = await get_payment(payment_id)

    if payment.status == "SUCCESS":
        return payment

    if payment.provider_ref and payment.provider_ref != razorpay_order_id:
        payment.status = "FAILED"
        payment.reason = "Order ID mismatch"
        payment.updated_at = datetime.utcnow()
        await payment.save()
        return payment

    try:
        # Verify the signature
        params_dict = {
            'razorpay_order_id': razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature': signature
        }
        client.utility.verify_payment_signature(params_dict)

        payment.status = "SUCCESS"
        payment.provider_ref = razorpay_payment_id
        payment.updated_at = datetime.utcnow()
        await payment.save()

        logger.info(f"Payment {payment.id} verified successfully (Razorpay ID: {razorpay_payment_id})")
        return payment

    except razorpay.errors.SignatureVerificationError as e:
        logger.warning(f"Invalid signature for payment {payment.id}: {str(e)}")
        payment.status = "FAILED"
        payment.reason = "Invalid payment signature"
        payment.updated_at = datetime.utcnow()
        await payment.save()
        return payment
    except Exception as e:
        logger.error(f"Error verifying payment {payment.id}: {str(e)}")
        payment.status = "FAILED"
        payment.reason = f"Verification error: {str(e)}"
        payment.updated_at = datetime.utcnow()
        await payment.save()
        return payment

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
