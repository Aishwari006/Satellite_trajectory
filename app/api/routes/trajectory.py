import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.db import crud

from app.services.trajectory_service import TrajectoryService
from app.schemas.trajectory import TrajectoryResponse

router = APIRouter(prefix="/trajectory", tags=["Trajectory"])
logger = logging.getLogger(__name__)

trajectory_service = TrajectoryService()

@router.get("/missions")
def list_missions(db: Session = Depends(get_db)):
    missions = crud.list_missions(db)

    return [
        {
            "id": m.id,
            "name": m.name,
            "mission_type": m.mission_type,
            "status": m.status,
            "created_at": m.created_at,
        }
        for m in missions
    ]
    
@router.get("/full/{mission_id}")
def get_full_trajectory(
    mission_id: int,
    db: Session = Depends(get_db),
):
    try:
        return trajectory_service.get_full_trajectory_response(db, mission_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
@router.get("/{mission_id}", response_model=TrajectoryResponse)
def get_trajectory(
    mission_id: int,
    db: Session = Depends(get_db),
) -> TrajectoryResponse:
    """
    Return trajectory data for a given mission in the frontend-expected format:
      { time, positions, speed, events, mission_phase }
    """
    try:
        data = trajectory_service.get_trajectory_response(db, mission_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.exception("Error fetching trajectory for mission %d: %s", mission_id, exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Server error")

    return TrajectoryResponse(**data)