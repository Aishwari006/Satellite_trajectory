import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.analytics_service import AnalyticsService
from app.schemas.trajectory import MoonAnalyticsResponse, SatelliteAnalyticsResponse
from typing import Union

router = APIRouter(prefix="/analytics", tags=["Analytics"])
logger = logging.getLogger(__name__)

analytics_service = AnalyticsService()


@router.get(
    "/{mission_id}",
    response_model=Union[MoonAnalyticsResponse, SatelliteAnalyticsResponse],
)
def get_analytics(
    mission_id: int,
    db: Session = Depends(get_db),
) -> Union[MoonAnalyticsResponse, SatelliteAnalyticsResponse]:
    """
    Compute and return mission-type-specific KPIs for the dashboard.

    - Moon missions: total distance, max speed, closest Moon approach
    - Satellite missions: altitude profile, orbital period, velocity stability
    """
    try:
        analytics = analytics_service.compute(db, mission_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.exception("Analytics computation failed for mission %d: %s", mission_id, exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Server error")

    mission_type = analytics.get("mission_type", "")
    if mission_type == "moon":
        return MoonAnalyticsResponse(**analytics)
    return SatelliteAnalyticsResponse(**analytics)