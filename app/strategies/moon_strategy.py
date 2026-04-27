import numpy as np
import pandas as pd
from typing import Any

from app.strategies.base_strategy import BaseStrategy
from app.core.config import MissionConfig


class MoonStrategy(BaseStrategy):
    """
    Pipeline for Earth → Moon transfer trajectories.

    Key responsibilities:
    - Track Earth, Moon and Spacecraft bodies
    - Compute closest Moon approach
    - Summarise transfer metrics using distance_from_moon
    """

    def __init__(self, config: MissionConfig) -> None:
        super().__init__(config)

    # ── 1. Validation ────────────────────────────────────────────────────────

    def validate_dataframe(self, df: pd.DataFrame) -> None:
        self._assert_columns(df, self.config.required_columns)

    # ── 2. Processing ────────────────────────────────────────────────────────

    def process(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()

        # Ensure optional columns exist (fill with NaN if absent)
        df = self._fill_optional_columns(df, self.config.optional_columns)

        # Coerce numeric types
        numeric_cols = [
            "time", "x", "y", "z", "vx", "vy", "vz",
            "ax", "ay", "az", "distance_from_earth",
            "distance_from_moon", "speed",
        ]
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        # Drop rows where positional data is entirely missing
        df = df.dropna(subset=["x", "y", "z"])

        # Recalculate speed if absent / all-NaN
        if df["speed"].isna().all():
            df["speed"] = np.sqrt(
                df["vx"] ** 2 + df["vy"] ** 2 + df["vz"] ** 2
            )

        # Recalculate distance_from_earth if absent
        if df["distance_from_earth"].isna().all():
            df["distance_from_earth"] = np.sqrt(
                df["x"] ** 2 + df["y"] ** 2 + df["z"] ** 2
            )

        # Normalise event_flag to bool
        if "event_flag" in df.columns:
            df["event_flag"] = df["event_flag"].fillna(False).astype(bool)

        # Sort chronologically
        df = df.sort_values("time").reset_index(drop=True)

        return df

    # ── 3. Analytics ─────────────────────────────────────────────────────────

    def compute_analytics(self, df: pd.DataFrame) -> dict[str, Any]:
        positions = df[["x", "y", "z"]].to_numpy()
        displacements = np.diff(positions, axis=0)
        segment_distances = np.linalg.norm(displacements, axis=1)
        total_distance = float(segment_distances.sum())

        speed_series = df["speed"].dropna()
        max_speed = float(speed_series.max()) if not speed_series.empty else 0.0
        avg_speed = float(speed_series.mean()) if not speed_series.empty else 0.0

        closest_moon: float | None = None
        if "distance_from_moon" in df.columns and not df["distance_from_moon"].isna().all():
            closest_moon = float(df["distance_from_moon"].min())

        mission_duration = float(df["time"].max() - df["time"].min())

        return {
            "mission_type": "moon",
            "total_distance_km": round(total_distance, 3),
            "max_speed_km_s": round(max_speed, 6),
            "avg_speed_km_s": round(avg_speed, 6),
            "closest_moon_approach_km": round(closest_moon, 3) if closest_moon is not None else None,
            "mission_duration_s": round(mission_duration, 2),
            "phase_breakdown": self._phase_breakdown(df),
        }