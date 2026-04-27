import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.services.trajectory_service import TrajectoryService
from app.schemas.trajectory import UploadResponse

router = APIRouter(prefix="/upload", tags=["Upload"])
logger = logging.getLogger(__name__)

trajectory_service = TrajectoryService()

ALLOWED_CONTENT_TYPES = {"text/csv", "application/octet-stream", "application/csv"}
MAX_BYTES = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


@router.post("", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_trajectory(
    file: UploadFile = File(..., description="CSV trajectory dataset"),
    mission_type: str = Form(..., description="'moon' or 'satellite'"),
    mission_name: str = Form(default="Unnamed Mission"),
    db: Session = Depends(get_db),
) -> UploadResponse:
    """
    Accept a CSV file and mission configuration.
    Triggers the full ingest pipeline and returns the created mission ID.
    """
    
    # Validate mission_type before doing anything else to fail fast
    if mission_type not in ["moon", "satellite"]:
        raise HTTPException(
            status_code=400,
            detail="mission_type must be 'moon' or 'satellite'"
        )

    # File size guard
    raw_bytes = await file.read()
    if len(raw_bytes) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB} MB.",
        )

    if not raw_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file uploaded.")

    try:
        mission, rows = trajectory_service.ingest(
            db=db,
            raw_bytes=raw_bytes,
            mission_type=mission_type,
            mission_name=mission_name,
            filename=file.filename,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        logger.exception("Unexpected error during ingest: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during data ingest.",
        )

    return UploadResponse(
        mission_id=mission.id,
        mission_type=mission.mission_type,
        status=mission.status,
        rows_ingested=rows,
        message=f"Mission '{mission_name}' ingested successfully with {rows} trajectory points.",
    )