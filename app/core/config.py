from dataclasses import dataclass, field
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Artemis Mission Control API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = "password"
    DB_NAME: str = "artemis_db"

    DATABASE_URL_OVERRIDE: Optional[str] = None

    @property
    def DATABASE_URL(self) -> str:
        import os
        # 1. Explicit DATABASE_URL env var or override takes top priority
        env_url = os.environ.get("DATABASE_URL") or self.DATABASE_URL_OVERRIDE
        if env_url:
            # Normalize postgres:// -> postgresql+psycopg://
            if env_url.startswith("postgres://"):
                env_url = env_url.replace("postgres://", "postgresql+psycopg://", 1)
            elif env_url.startswith("postgresql://") and "+" not in env_url.split("://", 1)[0]:
                env_url = env_url.replace("postgresql://", "postgresql+psycopg://", 1)
            return env_url
        # 2. Build MySQL URL from individual DB_* settings (loaded from .env)
        if self.DB_HOST and self.DB_NAME:
            return (
                f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
                f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
            )
        # 3. Fallback: local SQLite file (no external DB dependencies)
        return "sqlite:///./artemis.db"

    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    MAX_UPLOAD_SIZE_MB: int = 50

    class Config:
        env_file = ("app/.env", ".env")
        extra = "ignore"


@dataclass
class MissionConfig:
    mission_type: str
    use_moon_distance: bool
    use_lunar_analytics: bool
    use_orbital_analytics: bool
    tracked_bodies: list[str]
    required_columns: list[str]
    optional_columns: list[str]
    analytics_label: str
    description: str


MOON_CONFIG = MissionConfig(
    mission_type="moon",
    use_moon_distance=True,
    use_lunar_analytics=True,
    use_orbital_analytics=False,
    tracked_bodies=["Earth", "Moon", "Spacecraft"],
    required_columns=["time", "x", "y", "z", "vx", "vy", "vz", "speed", "distance_from_earth"],
    optional_columns=["ax", "ay", "az", "distance_from_moon", "mission_phase", "event_flag", "body"],
    analytics_label="Lunar Transfer Analytics",
    description="Earth-to-Moon trajectory simulation with lunar approach metrics",
)

SATELLITE_CONFIG = MissionConfig(
    mission_type="satellite",
    use_moon_distance=False,
    use_lunar_analytics=False,
    use_orbital_analytics=True,
    tracked_bodies=["Earth", "Satellite"],
    required_columns=["time", "x", "y", "z", "vx", "vy", "vz", "speed", "distance_from_earth"],
    optional_columns=["ax", "ay", "az", "mission_phase", "event_flag", "body"],
    analytics_label="Orbital Analytics",
    description="Earth-orbiting satellite trajectory with orbital mechanics metrics",
)

MISSION_CONFIGS: dict[str, MissionConfig] = {
    "moon": MOON_CONFIG,
    "satellite": SATELLITE_CONFIG,
}


def get_mission_config(mission_type: str) -> MissionConfig:
    config = MISSION_CONFIGS.get(mission_type.lower())
    if not config:
        raise ValueError(
            f"Unknown mission_type '{mission_type}'. "
            f"Supported types: {list(MISSION_CONFIGS.keys())}"
        )
    return config


settings = Settings()