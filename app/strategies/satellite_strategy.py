import numpy as np
import pandas as pd
from typing import Any

from app.strategies.base_strategy import BaseStrategy
from app.core.config import MissionConfig

# Earth's mean radius in km
EARTH_RADIUS_KM = 6_371.0


class SatelliteStrategy(BaseStrategy):
    """
    Pipeline for Earth-orbiting satellite trajectories.

    Key responsibilities:
    - Process Earth + Satellite only (Moon data ignored)
    - Compute altitude profile from distance_from_earth
    - Estimate orbital period via time-series analysis
    - Report velocity stability as speed standard-deviation
    """

    def __init__(self, config: MissionConfig) -> None:
        super().__init__(config)

    # ── 1. Validation ────────────────────────────────────────────────────────

    def validate_dataframe(self, df: pd.DataFrame) -> None:
        self._assert_columns(df, self.config.required_columns)

    # ── 2. Processing ────────────────────────────────────────────────────────

    def process(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()

        # Drop Moon-specific column if present (not relevant)
        if "distance_from_moon" in df.columns:
            df = df.drop(columns=["distance_from_moon"])

        # Ensure optional satellite columns exist
        df = self._fill_optional_columns(df, self.config.optional_columns)

        # Coerce numeric types
        numeric_cols = [
            "time", "x", "y", "z", "vx", "vy", "vz",
            "ax", "ay", "az", "distance_from_earth", "speed",
        ]
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        # Drop rows missing positional data
        df = df.dropna(subset=["x", "y", "z"])

        # Recompute speed if absent
        if df["speed"].isna().all():
            df["speed"] = np.sqrt(
                df["vx"] ** 2 + df["vy"] ** 2 + df["vz"] ** 2
            )

        # Recompute distance_from_earth if absent
        if df["distance_from_earth"].isna().all():
            df["distance_from_earth"] = np.sqrt(
                df["x"] ** 2 + df["y"] ** 2 + df["z"] ** 2
            )

        # Derive altitude above Earth's surface
        df["altitude_km"] = df["distance_from_earth"] - EARTH_RADIUS_KM

        # Normalise event_flag
        if "event_flag" in df.columns:
            df["event_flag"] = df["event_flag"].fillna(False).astype(bool)

        df = df.sort_values("time").reset_index(drop=True)
        return df

    # ── 3. Analytics ─────────────────────────────────────────────────────────

    def compute_analytics(self, df: pd.DataFrame) -> dict[str, Any]:
        # ✅ FIX: ensure altitude exists
        if "altitude_km" not in df.columns:
            df["altitude_km"] = df["distance_from_earth"] - EARTH_RADIUS_KM
            
        alt_series = df["altitude_km"].dropna()
        avg_altitude = float(alt_series.mean()) if not alt_series.empty else 0.0
        max_altitude = float(alt_series.max()) if not alt_series.empty else 0.0
        min_altitude = float(alt_series.min()) if not alt_series.empty else 0.0

        speed_series = df["speed"].dropna()
        avg_speed = float(speed_series.mean()) if not speed_series.empty else 0.0
        velocity_stability = float(speed_series.std()) if not speed_series.empty else 0.0
        
        # ✅ Compute max speed
        max_speed = float(speed_series.max()) if not speed_series.empty else 0.0

        # ✅ Compute total distance (path integral of step-to-step movements)
        diffs = np.sqrt(
            np.diff(df["x"])**2 +
            np.diff(df["y"])**2 +
            np.diff(df["z"])**2
        )
        total_distance = float(np.sum(diffs))

        orbital_period = self._estimate_orbital_period(df)
        mission_duration = float(df["time"].max() - df["time"].min())

        return {
            "mission_type": "satellite",
            "total_distance_km": round(total_distance, 3),
            "max_speed_km_s": round(max_speed, 6),
            "avg_altitude_km": round(avg_altitude, 3),
            "max_altitude_km": round(max_altitude, 3),
            "min_altitude_km": round(min_altitude, 3),
            "avg_speed_km_s": round(avg_speed, 6),
            "orbital_period_estimate_s": round(orbital_period, 2) if orbital_period else None,
            "velocity_stability_stddev": round(velocity_stability, 6),
            "mission_duration_s": round(mission_duration, 2),
            "phase_breakdown": self._phase_breakdown(df),
        }

    # ── Private helpers ───────────────────────────────────────────────────────

    def _estimate_orbital_period(self, df: pd.DataFrame) -> float | None:
        """
        Estimate orbital period by detecting when the satellite crosses
        a reference plane (z == 0 crossing) in the same direction twice.
        Falls back to Kepler's 3rd law using average orbital radius.
        """
        try:
            z = df["z"].to_numpy()
            times = df["time"].to_numpy()

            # Zero-crossings with positive gradient
            crossings = []
            for i in range(1, len(z)):
                if z[i - 1] < 0 and z[i] >= 0:
                    crossings.append(times[i])

            if len(crossings) >= 2:
                periods = np.diff(crossings)
                return float(np.median(periods))

            # Kepler fallback: T = 2π√(a³/GM)
            GM = 3.986e5  # km³/s²
            a = float(df["distance_from_earth"].mean())
            if a > 0:
                return float(2 * np.pi * np.sqrt(a ** 3 / GM))
        except Exception:
            pass
        return None