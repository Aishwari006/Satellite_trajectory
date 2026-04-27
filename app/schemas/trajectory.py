from pydantic import BaseModel, field_validator
from typing import Optional, Literal
from datetime import datetime


# ─── Mission ────────────────────────────────────────────────────────────────

class MissionCreate(BaseModel):
    name: str
    mission_type: Literal["moon", "satellite"]

    @field_validator("mission_type")
    @classmethod
    def validate_mission_type(cls, v: str) -> str:
        if v not in ("moon", "satellite"):
            raise ValueError("mission_type must be 'moon' or 'satellite'")
        return v


class MissionRead(BaseModel):
    id: int
    name: str
    mission_type: str
    status: str
    original_filename: Optional[str]
    error_message: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# ─── Trajectory ─────────────────────────────────────────────────────────────

class TrajectoryPointRead(BaseModel):
    id: int
    mission_id: int
    time: float
    body: Optional[str]
    x: float
    y: float
    z: float
    vx: Optional[float]
    vy: Optional[float]
    vz: Optional[float]
    ax: Optional[float]
    ay: Optional[float]
    az: Optional[float]
    distance_from_earth: Optional[float]
    distance_from_moon: Optional[float]
    speed: Optional[float]
    mission_phase: Optional[str]
    event_flag: Optional[bool]

    class Config:
        from_attributes = True


# ─── Trajectory Response (frontend-optimised) ────────────────────────────────

class PositionPoint(BaseModel):
    x: float
    y: float
    z: float


class TrajectoryResponse(BaseModel):
    mission_id: int
    mission_type: str
    time: list[float]
    positions: list[PositionPoint]
    speed: list[Optional[float]]
    events: list[Optional[bool]]
    mission_phase: list[Optional[str]]
    distance_from_earth: list[Optional[float]]

# ─── Analytics Responses ─────────────────────────────────────────────────────

class MoonAnalyticsResponse(BaseModel):
    mission_id: int
    mission_type: str = "moon"
    total_distance_km: float
    max_speed_km_s: float
    avg_speed_km_s: float
    closest_moon_approach_km: Optional[float]
    mission_duration_s: float
    phase_breakdown: dict[str, int]


class SatelliteAnalyticsResponse(BaseModel):
    mission_id: int
    mission_type: str = "satellite"
    total_distance_km: float        # ✅ ADD
    max_speed_km_s: float          # ✅ ADD
    avg_altitude_km: float
    max_altitude_km: float
    min_altitude_km: float
    avg_speed_km_s: float
    orbital_period_estimate_s: Optional[float]
    velocity_stability_stddev: float
    mission_duration_s: float
    phase_breakdown: dict[str, int]


# ─── Upload Response ─────────────────────────────────────────────────────────

class UploadResponse(BaseModel):
    mission_id: int
    mission_type: str
    status: str
    rows_ingested: int
    message: str