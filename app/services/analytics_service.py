import logging
import pandas as pd
from sqlalchemy.orm import Session

from app.strategies import get_strategy
from app.db import crud
from app.utils.data_processing import df_to_trajectory_dicts

logger = logging.getLogger(__name__)

# Earth's mean radius (km) – used to reconstruct altitude column for satellite
EARTH_RADIUS_KM = 6_371.0


class AnalyticsService:
    """
    Re-runs the strategy analytics stage over persisted trajectory data.
    Keeps analytics computation decoupled from ingest (supports recompute).
    """

    def compute(self, db: Session, mission_id: int) -> dict:
        mission = crud.get_mission(db, mission_id)
        if not mission:
            raise ValueError(f"Mission {mission_id} not found")

        points = crud.get_trajectory_by_mission(db, mission_id)
        if not points:
            raise ValueError(f"No trajectory data found for mission {mission_id}")

        # Reconstruct a DataFrame from stored ORM objects
        rows = [
            {
                "time": p.time,
                "x": p.x,
                "y": p.y,
                "z": p.z,
                "vx": p.vx,
                "vy": p.vy,
                "vz": p.vz,
                "distance_from_earth": p.distance_from_earth,
                "distance_from_moon": p.distance_from_moon,
                "speed": p.speed,
                "mission_phase": p.mission_phase,
                "event_flag": p.event_flag,
            }
            for p in points
        ]
        df = pd.DataFrame(rows)

        # Delegate to the correct strategy for analytics computation
        strategy = get_strategy(mission.mission_type)
        analytics = strategy.compute_analytics(df)
        analytics["mission_id"] = mission_id

        logger.info(
            "Analytics computed for mission %d (%s): %s",
            mission_id,
            mission.mission_type,
            list(analytics.keys()),
        )
        return analytics