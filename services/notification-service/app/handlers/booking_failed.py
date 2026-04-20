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


async def handle_booking_failed(message: dict):
    booking_id = message.get("bookingId", "N/A")
    user_email = message.get("userEmail", "")
    reason = message.get("reason", "An unexpected error occurred")

    try:
        template = env.get_template("booking_failed.html")
        html = template.render(
            booking_id=booking_id,
            reason=reason,
            user_email=user_email,
        )
        subject = f"Booking Failed – Reference {booking_id}"
        success = await send_email(user_email, subject, html)

        notification = NotificationDocument(
            type="BOOKING_FAILED",
            recipient_email=user_email,
            subject=subject,
            body=html,
            status="SENT" if success else "FAILED",
            error=None if success else "SMTP delivery failed",
            metadata={
                "bookingId": booking_id,
                "reason": reason,
            },
        )
        await notification.insert()
        logger.info(
            f"Handled booking_failed for booking {booking_id}, email={'sent' if success else 'failed'}"
        )
    except Exception as e:
        logger.error(
            f"Failed to handle booking_failed for {booking_id}: {e}", exc_info=True
        )
