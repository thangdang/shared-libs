"""Configuration settings for Product Linker service."""

import os


class Settings:
    """Application settings loaded from environment variables."""

    def __init__(self):
        self.mongodb_uri: str = os.environ.get(
            "PRODUCT_LINKER_MONGODB_URI",
            "mongodb://localhost:27017/shared_services",
        )
        self.database_name: str = os.environ.get(
            "PRODUCT_LINKER_DB_NAME",
            "shared_services",
        )
        self.port: int = int(os.environ.get("PRODUCT_LINKER_PORT", "9004"))
        self.catalog_refresh_interval: int = int(
            os.environ.get("PRODUCT_LINKER_REFRESH_INTERVAL", "300")
        )


settings = Settings()
