from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db: str = "ticketflow_payments"
    kafka_bootstrap_servers: str = "localhost:9092"
    payment_success_rate: float = 0.95
    port: int = 3005

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
