from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db: str = "ticketflow_notifications"
    kafka_bootstrap_servers: str = "localhost:9092"
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_from: str = "noreply@ticketflow.com"
    smtp_username: str = ""
    smtp_password: str = ""
    port: int = 3006

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
