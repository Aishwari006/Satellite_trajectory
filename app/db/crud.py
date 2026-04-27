import logging
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.mission import Mission, MissionStatusEnum
from app.models.trajectory import TrajectoryPoint

logger = logging.getLogger(__name__)


# ── Mission CRUD ─────────────────────────────────────────────────────────────

def create_mission(db: Session, name: str, mission_type: str, filename: str | None = None) -> Mission:
    mission = Mission(name=name, mission_type=mission_type, original_filename=filename)
    db.add(mission)
    db.commit()
    db.refresh(mission)
    return mission


def get_mission(db: Session, mission_id: int) -> Mission | None:
    return db.get(Mission, mission_id)


def update_mission_status(
    db: Session,
    mission_id: int,
    status: MissionStatusEnum,
    error_message: str | None = None,
) -> None:
    mission = db.get(Mission, mission_id)
    if mission:
        mission.status = status
        if error_message:
            mission.error_message = error_message
        db.commit()


def list_missions(db: Session, skip: int = 0, limit: int = 50) -> list[Mission]:
    stmt = select(Mission).offset(skip).limit(limit).order_by(Mission.created_at.desc())
    return list(db.scalars(stmt).all())


def get_full_trajectory_by_mission(
    db: Session, mission_id: int, limit: int = 50000
) -> list[TrajectoryPoint]:
    stmt = (
        select(TrajectoryPoint)
        .where(TrajectoryPoint.mission_id == mission_id)
        .order_by(TrajectoryPoint.time)
        .limit(limit)
    )
    return list(db.scalars(stmt).all())

# ── Trajectory CRUD ──────────────────────────────────────────────────────────

def bulk_insert_trajectory(db: Session, records: list[dict]) -> int:
    """
    Performs a bulk insert using core INSERT for performance.
    Returns the number of rows inserted.
    """
    if not records:
        return 0
    db.bulk_insert_mappings(TrajectoryPoint, records)
    db.commit()
    logger.info("Bulk inserted %d trajectory points.", len(records))
    return len(records)


def get_trajectory_by_mission(
    db: Session, mission_id: int, limit: int = 50_000
) -> list[TrajectoryPoint]:
    stmt = (
        select(TrajectoryPoint)
        .where(
            TrajectoryPoint.mission_id == mission_id,
            TrajectoryPoint.body == "spacecraft"   # 🔥 FILTER ADDED
        )
        .order_by(TrajectoryPoint.time)
        .limit(limit)
    )
    return list(db.scalars(stmt).all())


def delete_trajectory_by_mission(db: Session, mission_id: int) -> int:
    rows = (
        db.query(TrajectoryPoint)
        .filter(TrajectoryPoint.mission_id == mission_id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return rows