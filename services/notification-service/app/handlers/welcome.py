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


async def handle_welcome(message: dict):
    user_email = message.get("email", "")
    user_name = message.get("name") or (
        user_email.split("@")[0] if user_email else "there"
    )

    try:
        template = env.get_template("welcome.html")
        html = template.render(
            name=user_name,
            email=user_email,
        )
        subject = "Welcome to TicketFlow!"
        success = await send_email(user_email, subject, html)

        notification = NotificationDocument(
            type="WELCOME",
            recipient_email=user_email,
            subject=subject,
            body=html,
            status="SENT" if success else "FAILED",
            error=None if success else "SMTP delivery failed",
            metadata={
                "userId": message.get("userId"),
                "name": user_name,
            },
        )
        await notification.insert()
        logger.info(
            f"Handled welcome for {user_email}, email={'sent' if success else 'failed'}"
        )
    except Exception as e:
        logger.error(f"Failed to handle welcome for {user_email}: {e}", exc_info=True)
