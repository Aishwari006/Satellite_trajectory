import json
import logging
from typing import Any, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel

from app.services.vision_service import VisionService

router = APIRouter(prefix="/vision", tags=["Vision"])
logger = logging.getLogger(__name__)

vision_service = VisionService()

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".webp"}
MAX_IMAGE_BYTES = 20 * 1024 * 1024  # 20 MB


# ─────────────────────────── Schemas ────────────────────────────────────────

class CraterDetectionResponse(BaseModel):
    image_width: int
    image_height: int
    crater_count: int
    craters: list[dict[str, Any]]
    annotated_image: Optional[str] = None  # data:image/png;base64,...


class OperationsResponse(BaseModel):
    operations: list[str]


# ─────────────────────────── Helpers ────────────────────────────────────────

async def _read_image(file: UploadFile) -> bytes:
    raw = await file.read()
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image exceeds 20 MB limit.",
        )
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty image uploaded.",
        )
    return raw


# ─────────────────────────── Endpoints ──────────────────────────────────────

@router.get("/operations", response_model=OperationsResponse)
def list_operations() -> OperationsResponse:
    """Return the list of supported OpenCV operations."""
    return OperationsResponse(operations=sorted(VisionService.SUPPORTED_OPERATIONS))


@router.post("/process")
async def process_image(
    file: UploadFile = File(..., description="Image to process (JPG/PNG/TIFF/WebP)"),
    operation: str = Form(..., description="OpenCV operation name"),
    params: str = Form("{}", description="JSON-encoded parameters dict"),
) -> Response:
    """
    Apply a single OpenCV transformation and return the processed image
    as image/png. `params` must be a JSON object such as `{"angle": 45}`.
    """
    raw = await _read_image(file)

    try:
        param_dict = json.loads(params) if params else {}
        if not isinstance(param_dict, dict):
            raise ValueError("params must be a JSON object")
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid params JSON: {exc}",
        )

    try:
        png_bytes = vision_service.process(raw, operation, param_dict)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc),
        )
    except Exception as exc:
        logger.exception("Image processing failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Image processing error.",
        )

    return Response(content=png_bytes, media_type="image/png")


@router.post("/detect-craters", response_model=CraterDetectionResponse)
async def detect_craters(
    file: UploadFile = File(..., description="Lunar image (JPEG / PNG / TIFF)"),
    sensitivity: float = Form(1.0, description="0.5 = strict, 2.0 = permissive"),
    annotate: bool = Form(True, description="Include annotated image in response"),
) -> CraterDetectionResponse:
    """
    Run crater detection (Hough Circle Transform on a CLAHE-enhanced grayscale
    image). Returns crater metadata and, optionally, an annotated PNG.
    """
    raw = await _read_image(file)

    try:
        result = vision_service.detect_craters_annotated(
            raw, return_image=annotate, draw_labels=True, sensitivity=sensitivity,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc),
        )
    except Exception as exc:
        logger.exception("Crater detection failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Vision processing error.",
        )

    return CraterDetectionResponse(**result)
