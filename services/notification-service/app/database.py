import logging
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.config import settings
from app.models.notification import NotificationDocument

logger = logging.getLogger(__name__)

motor_client: AsyncIOMotorClient = None


async def init_db():
    global motor_client
    motor_client = AsyncIOMotorClient(settings.mongodb_url)
    database = motor_client[settings.mongodb_db]
    await init_beanie(database=database, document_models=[NotificationDocument])
    logger.info(f"Connected to MongoDB: {settings.mongodb_db}")


def get_database():
    return motor_client[settings.mongodb_db]
