import logging
import pandas as pd
from sqlalchemy.orm import Session

from app.core.config import get_mission_config
from app.models.mission import Mission, MissionStatusEnum
from app.strategies import get_strategy
from app.utils.data_processing import parse_csv, df_to_trajectory_dicts
from app.db import crud

logger = logging.getLogger(__name__)


class TrajectoryService:
    """
    Orchestrates the full ingest pipeline:
      parse → validate → strategy.run() → persist → status update
    """

    def ingest(
        self,
        db: Session,
        raw_bytes: bytes,
        mission_type: str,
        mission_name: str,
        filename: str | None = None,
    ) -> tuple[Mission, int]:
        """
        Main entry point called by the upload route.

        Returns (mission, rows_ingested).
        Raises ValueError on validation failures.
        """
        # 1. Validate mission_type via config (raises ValueError if unknown)
        get_mission_config(mission_type)

        # 2. Create mission record (status=pending)
        mission = crud.create_mission(
            db, name=mission_name, mission_type=mission_type, filename=filename
        )
        logger.info("Created mission id=%d type=%s", mission.id, mission_type)

        try:
            # 3. Parse CSV
            crud.update_mission_status(db, mission.id, MissionStatusEnum.processing)
            df: pd.DataFrame = parse_csv(raw_bytes)

            # 4. Dispatch to correct strategy pipeline
            strategy = get_strategy(mission_type)
            processed_df, _analytics = strategy.run(df)

            # 5. Convert to DB records and persist
            records = df_to_trajectory_dicts(processed_df, mission.id)
            rows = crud.bulk_insert_trajectory(db, records)

            # 6. Mark completed
            crud.update_mission_status(db, mission.id, MissionStatusEnum.completed)
            logger.info("Mission %d ingested %d rows.", mission.id, rows)
            return mission, rows

        except Exception as exc:
            logger.error("Ingest failed for mission %d: %s", mission.id, exc)
            crud.update_mission_status(
                db,
                mission.id,
                MissionStatusEnum.failed,
                error_message=str(exc),
            )
            raise

    def get_trajectory_response(
        self, db: Session, mission_id: int
    ) -> dict:
        """
        Fetch stored points and reshape into the frontend-expected format.
        """
        mission = crud.get_mission(db, mission_id)
        if not mission:
            raise ValueError(f"Mission {mission_id} not found")

        points = crud.get_trajectory_by_mission(db, mission_id)

        return {
            "mission_id": mission_id,
            "mission_type": mission.mission_type,
            "time": [p.time for p in points],
            "body": [p.body for p in points],
            "distance_from_earth": [p.distance_from_earth for p in points],
            "positions": [{"x": p.x, "y": p.y, "z": p.z, "body": p.body} for p in points],
            "speed": [p.speed for p in points],
            "events": [p.event_flag for p in points],
            "mission_phase": [p.mission_phase for p in points],
        }

    def get_full_trajectory_response(
        self, db: Session, mission_id: int
    ) -> dict:
        """
        Fetch stored points and organize them by celestial body for frontend rendering.
        """
        mission = crud.get_mission(db, mission_id)
        if not mission:
            raise ValueError(f"Mission {mission_id} not found")

        points = crud.get_full_trajectory_by_mission(db, mission_id)

        # Separate bodies
        spacecraft = [p for p in points if p.body == "spacecraft"]
        moon = [p for p in points if p.body == "moon"]
        earth = [p for p in points if p.body == "earth"]

        def format_points(data):
            return {
                "time": [p.time for p in data],
                "positions": [{"x": p.x, "y": p.y, "z": p.z} for p in data],
                "speed": [p.speed for p in data],
                "mission_phase": [p.mission_phase for p in data],
            }

        return {
            "mission_id": mission_id,
            "mission_type": mission.mission_type,
            "spacecraft": format_points(spacecraft),
            "moon": format_points(moon),
            "earth": format_points(earth),
        }