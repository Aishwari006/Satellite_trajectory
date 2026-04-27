import io
import logging
from typing import Any

import cv2
import numpy as np

logger = logging.getLogger(__name__)


class VisionService:
    """
    Computer-vision module: detects craters in lunar imagery using
    Hough Circle Transform (OpenCV).
    """

    def detect_craters(self, image_bytes: bytes) -> dict[str, Any]:
        """
        Accepts raw image bytes (JPEG / PNG / TIFF).
        Returns detected circle (crater) coordinates and radii.
        """
        # Decode to numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image. Ensure it is a valid JPEG/PNG.")

        # Convert to grayscale and denoise
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (9, 9), 2)

        h, w = img.shape[:2]
        min_radius = max(5, int(min(h, w) * 0.01))
        max_radius = int(min(h, w) * 0.3)

        # Hough Circle Transform
        circles = cv2.HoughCircles(
            blurred,
            cv2.HOUGH_GRADIENT,
            dp=1.2,
            minDist=int(min(h, w) * 0.05),
            param1=100,
            param2=30,
            minRadius=min_radius,
            maxRadius=max_radius,
        )

        detections: list[dict] = []
        if circles is not None:
            circles = np.round(circles[0, :]).astype(int)
            for x, y, r in circles:
                detections.append(
                    {
                        "x": int(x),
                        "y": int(y),
                        "radius_px": int(r),
                        "confidence": self._estimate_confidence(blurred, x, y, r),
                    }
                )

        logger.info(
            "Crater detection complete: %d craters found in %dx%d image.",
            len(detections),
            w,
            h,
        )

        return {
            "image_width": w,
            "image_height": h,
            "crater_count": len(detections),
            "craters": detections,
        }

    # ── Private helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _estimate_confidence(gray: np.ndarray, cx: int, cy: int, r: int) -> float:
        """
        Rough confidence: ratio of edge pixels on the circle circumference
        relative to the expected circumference length.
        """
        try:
            mask = np.zeros_like(gray)
            cv2.circle(mask, (cx, cy), r, 255, 2)
            edges = cv2.Canny(gray, 50, 150)
            edge_on_circle = cv2.bitwise_and(edges, mask)
            ring_pixels = np.count_nonzero(mask)
            edge_pixels = np.count_nonzero(edge_on_circle)
            if ring_pixels == 0:
                return 0.0
            return round(min(edge_pixels / ring_pixels, 1.0), 3)
        except Exception:
            return 0.0