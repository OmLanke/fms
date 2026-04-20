import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import init_db
from app.kafka.consumer import start_consumer
from app.models.notification import NotificationDocument

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

_consumer_task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _consumer_task
    await init_db()
    _consumer_task = await start_consumer()
    yield
    if _consumer_task:
        _consumer_task.cancel()
        try:
            await _consumer_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="Notification Service",
    description="TicketFlow Notification Service – sends transactional emails via Kafka events",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "up", "service": "notification-service"}


@app.get("/api/notifications/recent")
async def recent_notifications():
    notifications = (
        await NotificationDocument.find()
        .sort(-NotificationDocument.created_at)
        .limit(20)
        .to_list()
    )
    return [
        {
            "id": n.id,
            "type": n.type,
            "recipientEmail": n.recipient_email,
            "subject": n.subject,
            "status": n.status,
            "error": n.error,
            "metadata": n.metadata,
            "createdAt": n.created_at.isoformat(),
        }
        for n in notifications
    ]


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "INTERNAL_ERROR", "message": str(exc)}},
    )
