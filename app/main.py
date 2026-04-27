import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import init_db, check_db_connection
from app.api.routes import upload, trajectory, analytics, vision
from app.core.database import init_db
# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("🚀 Starting %s v%s", settings.APP_NAME, settings.APP_VERSION)
    init_db()
    if check_db_connection():
        logger.info("✅ Database connection verified.")
    else:
        logger.warning("⚠️  Database is NOT reachable. Check DB_* environment variables.")
    yield
    logger.info("🛑 Shutting down %s.", settings.APP_NAME)


# ── Application ───────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Mission Control & Trajectory Analytics API — "
        "supports Moon transfer and Earth-orbiting satellite missions."
    ),
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",  # 👈 YOUR FRONTEND
        "http://localhost:5173",  # (just in case)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
API_PREFIX = "/api/v1"

app.include_router(upload.router, prefix=API_PREFIX)
app.include_router(trajectory.router, prefix=API_PREFIX)
app.include_router(analytics.router, prefix=API_PREFIX)
app.include_router(vision.router, prefix=API_PREFIX)

@app.on_event("startup")
def on_startup():
    init_db()
# ── Health endpoints ──────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
def health_check() -> JSONResponse:
    db_ok = check_db_connection()
    return JSONResponse(
        status_code=200 if db_ok else 503,
        content={
            "status": "healthy" if db_ok else "degraded",
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "database": "connected" if db_ok else "unreachable",
        },
    )


@app.get("/", tags=["Root"])
def root() -> dict:
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }