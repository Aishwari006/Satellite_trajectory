from abc import ABC, abstractmethod
from typing import Any
import pandas as pd

from app.core.config import MissionConfig


class BaseStrategy(ABC):
    """
    Abstract base for mission-type-specific processing pipelines.

    Each concrete strategy receives a MissionConfig at construction time and
    implements three pipeline stages:
      1. validate_dataframe  – column presence / type checks
      2. process             – cleaning, normalisation, derived metrics
      3. compute_analytics   – domain-specific KPI computation
    """

    def __init__(self, config: MissionConfig) -> None:
        self.config = config

    # ── Pipeline entry-point ────────────────────────────────────────────────

    def run(self, df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, Any]]:
        """
        Executes the full pipeline and returns (processed_df, analytics_dict).
        """
        self.validate_dataframe(df)
        processed = self.process(df)
        analytics = self.compute_analytics(processed)
        return processed, analytics

    # ── Abstract stages ─────────────────────────────────────────────────────

    @abstractmethod
    def validate_dataframe(self, df: pd.DataFrame) -> None:
        """
        Raise ValueError if required columns are absent or malformed.
        """

    @abstractmethod
    def process(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Clean, normalise and enrich the raw DataFrame.
        Returns a fully processed copy.
        """

    @abstractmethod
    def compute_analytics(self, df: pd.DataFrame) -> dict[str, Any]:
        """
        Compute mission-specific KPIs from the processed DataFrame.
        Returns a plain dict ready for schema serialisation.
        """

    # ── Shared helpers ───────────────────────────────────────────────────────

    def _assert_columns(self, df: pd.DataFrame, columns: list[str]) -> None:
        missing = [c for c in columns if c not in df.columns]
        if missing:
            raise ValueError(
                f"[{self.config.mission_type}] Missing required columns: {missing}"
            )

    def _fill_optional_columns(
        self, df: pd.DataFrame, columns: list[str]
    ) -> pd.DataFrame:
        for col in columns:
            if col not in df.columns:
                df[col] = None
        return df

    def _phase_breakdown(self, df: pd.DataFrame) -> dict[str, int]:
        if "mission_phase" not in df.columns or df["mission_phase"].isna().all():
            return {}
        return df["mission_phase"].value_counts().to_dict()