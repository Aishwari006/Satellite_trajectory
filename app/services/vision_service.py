import base64
import logging
from typing import Any, Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)


class VisionService:
    """
    OpenCV-powered computer-vision module:
      • Generic image transformations (rotate, flip, crop, color, scale, …)
      • Crater detection on lunar / planetary surface imagery
        (Hough Circle Transform + contour fallback)
    """

    # ───────────────────────── Decoding / encoding ──────────────────────────

    @staticmethod
    def _decode(image_bytes: bytes) -> np.ndarray:
        """Bytes → BGR ndarray. Raises ValueError on failure."""
        if not image_bytes:
            raise ValueError("Empty image payload.")
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image. Ensure it is a valid JPEG/PNG/TIFF.")
        return img

    @staticmethod
    def _encode_png(img: np.ndarray) -> bytes:
        """ndarray → PNG bytes."""
        if img.ndim == 2:
            # Grayscale → encode as single-channel PNG
            ok, buf = cv2.imencode(".png", img)
        else:
            ok, buf = cv2.imencode(".png", img)
        if not ok:
            raise ValueError("Failed to encode image as PNG.")
        return buf.tobytes()

    @staticmethod
    def _to_b64(png_bytes: bytes) -> str:
        return "data:image/png;base64," + base64.b64encode(png_bytes).decode("ascii")

    # ─────────────────────── Generic image processing ───────────────────────

    SUPPORTED_OPERATIONS = {
        "grayscale", "rotate", "flip", "crop", "resize",
        "brightness", "contrast", "brightness_contrast",
        "blur", "gaussian_blur", "median_blur", "sharpen",
        "edges", "threshold", "adaptive_threshold",
        "equalize", "clahe", "invert",
        "hsv_adjust", "sepia", "colormap",
        "morph",
    }

    def process(self, image_bytes: bytes, operation: str, params: dict) -> bytes:
        """
        Apply a single OpenCV operation and return the processed image as PNG bytes.

        `params` is a dict of operation-specific keyword arguments.
        """
        img = self._decode(image_bytes)
        op = (operation or "").strip().lower()

        if op not in self.SUPPORTED_OPERATIONS:
            raise ValueError(
                f"Unsupported operation '{operation}'. "
                f"Supported: {sorted(self.SUPPORTED_OPERATIONS)}"
            )

        try:
            handler = getattr(self, f"_op_{op}")
        except AttributeError as exc:
            raise ValueError(f"Operation '{op}' is not implemented.") from exc

        out = handler(img, params or {})
        return self._encode_png(out)

    # ─── Individual operations (each returns an ndarray) ────────────────────

    @staticmethod
    def _op_grayscale(img: np.ndarray, _params: dict) -> np.ndarray:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # Re-expand to 3 channels so downstream pipelines stay BGR.
        return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)

    @staticmethod
    def _op_rotate(img: np.ndarray, params: dict) -> np.ndarray:
        angle = float(params.get("angle", 90.0))
        scale = float(params.get("scale", 1.0))
        h, w = img.shape[:2]
        center = (w / 2, h / 2)
        M = cv2.getRotationMatrix2D(center, angle, scale)

        # Compute bounding box for the rotated image so nothing is clipped.
        cos = abs(M[0, 0])
        sin = abs(M[0, 1])
        new_w = int((h * sin) + (w * cos))
        new_h = int((h * cos) + (w * sin))
        M[0, 2] += (new_w / 2) - center[0]
        M[1, 2] += (new_h / 2) - center[1]

        return cv2.warpAffine(
            img, M, (new_w, new_h),
            flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0),
        )

    @staticmethod
    def _op_flip(img: np.ndarray, params: dict) -> np.ndarray:
        direction = str(params.get("direction", "horizontal")).lower()
        code = {"horizontal": 1, "vertical": 0, "both": -1}.get(direction)
        if code is None:
            raise ValueError("flip direction must be horizontal|vertical|both")
        return cv2.flip(img, code)

    @staticmethod
    def _op_crop(img: np.ndarray, params: dict) -> np.ndarray:
        h, w = img.shape[:2]
        # Accept either pixel coordinates or normalized 0..1.
        x = float(params.get("x", 0))
        y = float(params.get("y", 0))
        cw = float(params.get("width", w))
        ch = float(params.get("height", h))
        if max(x, y, cw, ch) <= 1.0:  # treat as normalized
            x, y, cw, ch = x * w, y * h, cw * w, ch * h
        x1 = max(0, int(x))
        y1 = max(0, int(y))
        x2 = min(w, int(x + cw))
        y2 = min(h, int(y + ch))
        if x2 <= x1 or y2 <= y1:
            raise ValueError("crop region has zero area")
        return img[y1:y2, x1:x2].copy()

    @staticmethod
    def _op_resize(img: np.ndarray, params: dict) -> np.ndarray:
        h, w = img.shape[:2]
        if "scale" in params:
            s = float(params["scale"])
            if s <= 0:
                raise ValueError("scale must be > 0")
            new_w, new_h = max(1, int(w * s)), max(1, int(h * s))
        else:
            new_w = int(params.get("width", w))
            new_h = int(params.get("height", h))
            if new_w <= 0 or new_h <= 0:
                raise ValueError("width/height must be > 0")
        interp = cv2.INTER_AREA if (new_w * new_h) < (w * h) else cv2.INTER_CUBIC
        return cv2.resize(img, (new_w, new_h), interpolation=interp)

    @staticmethod
    def _op_brightness(img: np.ndarray, params: dict) -> np.ndarray:
        beta = float(params.get("value", 30))  # -100..100 typical
        return cv2.convertScaleAbs(img, alpha=1.0, beta=beta)

    @staticmethod
    def _op_contrast(img: np.ndarray, params: dict) -> np.ndarray:
        alpha = float(params.get("value", 1.5))  # 0..3 typical
        return cv2.convertScaleAbs(img, alpha=alpha, beta=0)

    @staticmethod
    def _op_brightness_contrast(img: np.ndarray, params: dict) -> np.ndarray:
        alpha = float(params.get("contrast", 1.0))
        beta = float(params.get("brightness", 0))
        return cv2.convertScaleAbs(img, alpha=alpha, beta=beta)

    @staticmethod
    def _odd_kernel(k: int, default: int = 5) -> int:
        try:
            k = int(k)
        except (TypeError, ValueError):
            k = default
        k = max(1, k)
        return k if k % 2 == 1 else k + 1

    @classmethod
    def _op_blur(cls, img: np.ndarray, params: dict) -> np.ndarray:
        k = cls._odd_kernel(params.get("kernel", 5))
        return cv2.blur(img, (k, k))

    @classmethod
    def _op_gaussian_blur(cls, img: np.ndarray, params: dict) -> np.ndarray:
        k = cls._odd_kernel(params.get("kernel", 5))
        sigma = float(params.get("sigma", 0))
        return cv2.GaussianBlur(img, (k, k), sigma)

    @classmethod
    def _op_median_blur(cls, img: np.ndarray, params: dict) -> np.ndarray:
        k = cls._odd_kernel(params.get("kernel", 5))
        return cv2.medianBlur(img, k)

    @staticmethod
    def _op_sharpen(img: np.ndarray, params: dict) -> np.ndarray:
        amount = float(params.get("amount", 1.0))
        # Unsharp masking: original + amount * (original − blurred)
        blurred = cv2.GaussianBlur(img, (0, 0), sigmaX=3)
        sharp = cv2.addWeighted(img, 1 + amount, blurred, -amount, 0)
        return sharp

    @staticmethod
    def _op_edges(img: np.ndarray, params: dict) -> np.ndarray:
        low = int(params.get("low", 80))
        high = int(params.get("high", 180))
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, low, high)
        return cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)

    @staticmethod
    def _op_threshold(img: np.ndarray, params: dict) -> np.ndarray:
        thresh = int(params.get("value", 127))
        max_val = int(params.get("max", 255))
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, binarized = cv2.threshold(gray, thresh, max_val, cv2.THRESH_BINARY)
        return cv2.cvtColor(binarized, cv2.COLOR_GRAY2BGR)

    @classmethod
    def _op_adaptive_threshold(cls, img: np.ndarray, params: dict) -> np.ndarray:
        block = cls._odd_kernel(params.get("block", 11), default=11)
        if block < 3:
            block = 3
        c = int(params.get("c", 2))
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        out = cv2.adaptiveThreshold(
            gray, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY,
            block, c,
        )
        return cv2.cvtColor(out, cv2.COLOR_GRAY2BGR)

    @staticmethod
    def _op_equalize(img: np.ndarray, _params: dict) -> np.ndarray:
        # Per-channel equalization in YCrCb space preserves color.
        ycrcb = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb)
        ycrcb[..., 0] = cv2.equalizeHist(ycrcb[..., 0])
        return cv2.cvtColor(ycrcb, cv2.COLOR_YCrCb2BGR)

    @staticmethod
    def _op_clahe(img: np.ndarray, params: dict) -> np.ndarray:
        clip = float(params.get("clip", 2.0))
        tile = int(params.get("tile", 8))
        clahe = cv2.createCLAHE(clipLimit=clip, tileGridSize=(tile, tile))
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        lab[..., 0] = clahe.apply(lab[..., 0])
        return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    @staticmethod
    def _op_invert(img: np.ndarray, _params: dict) -> np.ndarray:
        return cv2.bitwise_not(img)

    @staticmethod
    def _op_hsv_adjust(img: np.ndarray, params: dict) -> np.ndarray:
        hue_shift = float(params.get("hue", 0))         # -180..180
        sat_scale = float(params.get("saturation", 1))  # 0..3
        val_scale = float(params.get("value", 1))       # 0..3
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
        hsv[..., 0] = (hsv[..., 0] + hue_shift) % 180
        hsv[..., 1] = np.clip(hsv[..., 1] * sat_scale, 0, 255)
        hsv[..., 2] = np.clip(hsv[..., 2] * val_scale, 0, 255)
        return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)

    @staticmethod
    def _op_sepia(img: np.ndarray, _params: dict) -> np.ndarray:
        kernel = np.array([
            [0.272, 0.534, 0.131],
            [0.349, 0.686, 0.168],
            [0.393, 0.769, 0.189],
        ])
        sepia = cv2.transform(img, kernel)
        return np.clip(sepia, 0, 255).astype(np.uint8)

    @staticmethod
    def _op_colormap(img: np.ndarray, params: dict) -> np.ndarray:
        name = str(params.get("map", "INFERNO")).upper()
        cmap_attr = f"COLORMAP_{name}"
        cmap = getattr(cv2, cmap_attr, cv2.COLORMAP_INFERNO)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        return cv2.applyColorMap(gray, cmap)

    @classmethod
    def _op_morph(cls, img: np.ndarray, params: dict) -> np.ndarray:
        op_name = str(params.get("op", "open")).lower()
        k = cls._odd_kernel(params.get("kernel", 5))
        ops = {
            "erode": cv2.MORPH_ERODE,
            "dilate": cv2.MORPH_DILATE,
            "open": cv2.MORPH_OPEN,
            "close": cv2.MORPH_CLOSE,
            "gradient": cv2.MORPH_GRADIENT,
            "tophat": cv2.MORPH_TOPHAT,
            "blackhat": cv2.MORPH_BLACKHAT,
        }
        if op_name not in ops:
            raise ValueError(f"morph op must be one of {list(ops)}")
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
        return cv2.morphologyEx(img, ops[op_name], kernel)

    # ────────────────────────── Crater detection ────────────────────────────

    def detect_craters(self, image_bytes: bytes) -> dict[str, Any]:
        """
        Original numeric-only crater detection (kept for backward compatibility).
        """
        result = self.detect_craters_annotated(
            image_bytes, return_image=False, draw_labels=False
        )
        result.pop("annotated_image", None)
        return result

    def detect_craters_annotated(
        self,
        image_bytes: bytes,
        return_image: bool = True,
        draw_labels: bool = True,
        sensitivity: float = 1.0,
    ) -> dict[str, Any]:
        """
        Detect craters on a planetary surface image and return:
          { image_width, image_height, crater_count, craters[],
            annotated_image (data-URL PNG, optional) }

        Uses Hough Circle Transform on a CLAHE-enhanced, blurred grayscale
        image. `sensitivity` (0.5..2.0) lowers the accumulator threshold to
        find more / fewer craters.
        """
        img = self._decode(image_bytes)
        h, w = img.shape[:2]

        # ── Preprocess: gray → CLAHE (boosts crater rim contrast) → blur ──
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        blurred = cv2.GaussianBlur(enhanced, (9, 9), 2)

        min_radius = max(5, int(min(h, w) * 0.01))
        max_radius = max(min_radius + 1, int(min(h, w) * 0.30))

        # Sensitivity tunes Hough's accumulator threshold (param2).
        sens = float(np.clip(sensitivity, 0.3, 3.0))
        param2 = max(10, int(30 / sens))

        circles = cv2.HoughCircles(
            blurred,
            cv2.HOUGH_GRADIENT,
            dp=1.2,
            minDist=int(min(h, w) * 0.04),
            param1=120,
            param2=param2,
            minRadius=min_radius,
            maxRadius=max_radius,
        )

        detections: list[dict] = []
        if circles is not None:
            circles = np.round(circles[0, :]).astype(int)
            # Sort by confidence descending so labels prioritise strong rims.
            scored = [
                (int(x), int(y), int(r), self._estimate_confidence(blurred, x, y, r))
                for x, y, r in circles
            ]
            scored.sort(key=lambda t: t[3], reverse=True)
            for idx, (x, y, r, conf) in enumerate(scored, start=1):
                detections.append({
                    "id": idx,
                    "x": x, "y": y,
                    "radius_px": r,
                    "diameter_px": r * 2,
                    "area_px": int(np.pi * r * r),
                    "confidence": conf,
                })

        annotated_b64: Optional[str] = None
        if return_image:
            annotated = self._draw_craters(img, detections, with_labels=draw_labels)
            annotated_b64 = self._to_b64(self._encode_png(annotated))

        logger.info(
            "Crater detection: %d craters in %dx%d (sensitivity=%.2f).",
            len(detections), w, h, sens,
        )

        out: dict[str, Any] = {
            "image_width": w,
            "image_height": h,
            "crater_count": len(detections),
            "craters": detections,
        }
        if annotated_b64 is not None:
            out["annotated_image"] = annotated_b64
        return out

    @staticmethod
    def _draw_craters(
        img: np.ndarray, craters: list[dict], with_labels: bool = True
    ) -> np.ndarray:
        canvas = img.copy()
        h, w = canvas.shape[:2]
        # Scale visual elements to the image size.
        thickness = max(1, int(round(min(h, w) / 600)))
        font_scale = max(0.4, min(h, w) / 1200)

        # Translucent overlay for filled circles.
        overlay = canvas.copy()
        for c in craters:
            x, y, r = c["x"], c["y"], c["radius_px"]
            cv2.circle(overlay, (x, y), r, (0, 200, 255), -1)
        canvas = cv2.addWeighted(overlay, 0.15, canvas, 0.85, 0)

        for c in craters:
            x, y, r = c["x"], c["y"], c["radius_px"]
            # Outer ring (cyan), centre dot (red).
            cv2.circle(canvas, (x, y), r, (255, 220, 0), thickness)
            cv2.circle(canvas, (x, y), max(1, thickness), (0, 0, 255), -1)
            if with_labels:
                label = f"#{c['id']}"
                tx, ty = x + r + 4, max(15, y - r - 4)
                cv2.putText(
                    canvas, label, (tx, ty),
                    cv2.FONT_HERSHEY_SIMPLEX, font_scale,
                    (0, 0, 0), thickness + 2, cv2.LINE_AA,
                )
                cv2.putText(
                    canvas, label, (tx, ty),
                    cv2.FONT_HERSHEY_SIMPLEX, font_scale,
                    (255, 255, 255), thickness, cv2.LINE_AA,
                )

        # Header banner with crater count.
        banner = f"Craters detected: {len(craters)}"
        (tw, th), _ = cv2.getTextSize(
            banner, cv2.FONT_HERSHEY_SIMPLEX, font_scale * 1.2, thickness + 1,
        )
        cv2.rectangle(canvas, (8, 8), (8 + tw + 16, 8 + th + 16), (20, 20, 20), -1)
        cv2.putText(
            canvas, banner, (16, 8 + th + 6),
            cv2.FONT_HERSHEY_SIMPLEX, font_scale * 1.2,
            (0, 255, 200), thickness + 1, cv2.LINE_AA,
        )
        return canvas

    @staticmethod
    def _estimate_confidence(gray: np.ndarray, cx: int, cy: int, r: int) -> float:
        """
        Confidence proxy: ratio of Canny edge pixels lying on the candidate
        circle's circumference vs. the expected ring length.
        """
        try:
            mask = np.zeros_like(gray)
            cv2.circle(mask, (int(cx), int(cy)), int(r), 255, 2)
            edges = cv2.Canny(gray, 50, 150)
            edge_on_circle = cv2.bitwise_and(edges, mask)
            ring_pixels = np.count_nonzero(mask)
            edge_pixels = np.count_nonzero(edge_on_circle)
            if ring_pixels == 0:
                return 0.0
            return round(min(edge_pixels / ring_pixels, 1.0), 3)
        except Exception:
            return 0.0
