# Artemis Mission Control Dashboard

Mission analytics + 3D trajectory visualization platform for Moon and Satellite missions, with an OpenCV-powered surface-image laboratory.

## Architecture

- **Frontend** — `frontend/` — React + Vite + TypeScript + Tailwind + shadcn/ui + Three.js
  - Dev server: port **5000**, host `0.0.0.0`, `allowedHosts: true`
  - Vite proxies `/api` and `/health` → backend on `127.0.0.1:8000`
- **Backend** — `app/` — FastAPI + SQLAlchemy + Pandas + OpenCV
  - Uvicorn on `127.0.0.1:8000`
  - Database: PostgreSQL via `DATABASE_URL` env var (Replit-provided), falls back to local SQLite (`artemis.db`) if unset. Driver: `psycopg` v3.
  - All API routes mounted under `/api/v1`

## Workflows

- `Start application` — `cd frontend && npm run dev` (webview, port 5000)
- `Backend` — `uvicorn app.main:app --host 127.0.0.1 --port 8000` (console, port 8000)

## Image Lab feature (`/image-lab`)

A new page below "Data Viewer" for OpenCV-based surface-image analysis:

- **Image Operations** tab — apply OpenCV transforms with live parameter controls:
  grayscale · rotate · flip · scale · brightness/contrast · gaussian/median blur ·
  sharpen (unsharp mask) · Canny edges · binary & adaptive threshold · histogram
  equalize · CLAHE · invert · HSV color shift · sepia · pseudo-color colormaps ·
  morphology (erode/dilate/open/close/gradient/tophat/blackhat).
- **Crater Analysis** tab — Hough Circle Transform on a CLAHE-enhanced grayscale
  with adjustable sensitivity. Returns crater count, top detections (with
  confidence based on Canny rim coverage), and an annotated PNG.

Key files:
- Backend service — `app/services/vision_service.py`
- Backend routes — `app/api/routes/vision.py` (`POST /api/v1/vision/process`,
  `POST /api/v1/vision/detect-craters`, `GET /api/v1/vision/operations`)
- Frontend page — `frontend/src/pages/ImageLab.tsx`
- Sidebar nav — `frontend/src/components/AppSidebar.tsx`
- Route registration — `frontend/src/App.tsx`

## Replit-specific changes from upstream

- Database swapped from MySQL → Replit PostgreSQL (with SQLite fallback)
- Added `psycopg[binary]` to Python deps
- Frontend API base URLs changed from hard-coded `http://127.0.0.1:8000` to
  relative `/api/v1/...` so requests flow through the Vite proxy
- Vite config: host `0.0.0.0`, port `5000`, `allowedHosts: true`, HMR over `wss`
  on the public 443 port
