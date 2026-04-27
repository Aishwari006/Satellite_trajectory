import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from pydantic import BaseModel
from typing import Any

from app.services.vision_service import VisionService

router = APIRouter(prefix="/vision", tags=["Vision"])
logger = logging.getLogger(__name__)

vision_service = VisionService()

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff"}
MAX_IMAGE_BYTES = 20 * 1024 * 1024  # 20 MB


class CraterDetectionResponse(BaseModel):
    image_width: int
    image_height: int
    crater_count: int
    craters: list[dict[str, Any]]


@router.post("/detect-craters", response_model=CraterDetectionResponse)
async def detect_craters(
    file: UploadFile = File(..., description="Lunar image (JPEG / PNG / TIFF)"),
) -> CraterDetectionResponse:
    """
    Run crater detection on an uploaded lunar surface image.
    Returns bounding circle data for each detected crater.
    """
    raw_bytes = await file.read()

    if len(raw_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image exceeds 20 MB limit.",
        )

    if not raw_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty image uploaded.")

    try:
        result = vision_service.detect_craters(raw_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        logger.exception("Crater detection failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Vision processing error.")

    return CraterDetectionResponse(**result)