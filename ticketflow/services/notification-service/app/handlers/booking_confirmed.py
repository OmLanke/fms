import logging
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pathlib import Path

from app.mailer.client import send_email
from app.models.notification import NotificationDocument

logger = logging.getLogger(__name__)

_template_dir = Path(__file__).parent.parent / "mailer" / "templates"
env = Environment(
    loader=FileSystemLoader(str(_template_dir)),
    autoescape=select_autoescape(["html"]),
)


async def handle_booking_confirmed(message: dict):
    booking_id = message.get("bookingId", "N/A")
    event_name = message.get("eventName", "Your Event")
    user_email = message.get("userEmail", "")

    try:
        template = env.get_template("booking_confirmed.html")
        html = template.render(
            booking_id=booking_id,
            event_name=event_name,
            event_date=message.get("eventDate", "TBD"),
            seats=message.get("seatIds", []),
            total_amount=message.get("totalAmount", 0),
            user_name=user_email.split("@")[0] if user_email else "there",
        )
        subject = f"Booking Confirmed – {event_name}"
        success = await send_email(user_email, subject, html)

        notification = NotificationDocument(
            type="BOOKING_CONFIRMED",
            recipient_email=user_email,
            subject=subject,
            body=html,
            status="SENT" if success else "FAILED",
            error=None if success else "SMTP delivery failed",
            metadata={
                "bookingId": booking_id,
                "eventName": event_name,
            },
        )
        await notification.insert()
        logger.info(
            f"Handled booking_confirmed for booking {booking_id}, email={'sent' if success else 'failed'}"
        )
    except Exception as e:
        logger.error(
            f"Failed to handle booking_confirmed for {booking_id}: {e}", exc_info=True
        )
