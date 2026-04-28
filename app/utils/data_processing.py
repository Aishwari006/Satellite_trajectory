import io
import logging
import pandas as pd

logger = logging.getLogger(__name__)

# Canonical column rename map (handles common variants)
COLUMN_ALIASES: dict[str, str] = {
    "timestamp": "time",
    "t": "time",
    "pos_x": "x",
    "pos_y": "y",
    "pos_z": "z",
    "vel_x": "vx",
    "vel_y": "vy",
    "vel_z": "vz",
    "acc_x": "ax",
    "acc_y": "ay",
    "acc_z": "az",
    "dist_earth": "distance_from_earth",
    "dist_moon": "distance_from_moon",
    "phase": "mission_phase",
    "event": "event_flag",
}


def parse_csv(raw_bytes: bytes) -> pd.DataFrame:
    """
    Parse raw CSV bytes into a DataFrame.
    - Strips whitespace from column names
    - Applies canonical column aliases
    - Drops fully-empty rows
    """
    try:
        df = pd.read_csv(io.BytesIO(raw_bytes))
    except Exception as exc:
        raise ValueError(f"Failed to parse CSV: {exc}") from exc

    # Normalise column names
    df.columns = [c.strip().lower() for c in df.columns]
    df = df.rename(columns=COLUMN_ALIASES)
    df = df.dropna(how="all")

    logger.info("Parsed CSV: %d rows, columns=%s", len(df), list(df.columns))
    return df


def df_to_trajectory_dicts(df: pd.DataFrame, mission_id: int) -> list[dict]:
    """
    Convert a processed DataFrame to a list of dicts suitable for bulk DB insert.
    Uses to_dict for proper Python native type conversion (required by PyMySQL).
    Explicitly replaces pd.NA / numpy.nan with None to avoid MySQL ProgrammingError.
    Sets default 'body' to 'spacecraft' so the frontend filter matches it.
    """
    raw_records = df.to_dict(orient="records")
    
    column_map = {
        "time": "time",
        "body": "body",
        "x": "x",
        "y": "y",
        "z": "z",
        "vx": "vx",
        "vy": "vy",
        "vz": "vz",
        "ax": "ax",
        "ay": "ay",
        "az": "az",
        "distance_from_earth": "distance_from_earth",
        "distance_from_moon": "distance_from_moon",
        "speed": "speed",
        "mission_phase": "mission_phase",
        "event_flag": "event_flag",
    }
    
    records = []
    for row in raw_records:
        record: dict = {"mission_id": mission_id}
        for csv_col, db_col in column_map.items():
            if csv_col in row:
                val = row[csv_col]
                # PyMySQL crashes if given float('nan'). Force it to None (NULL in DB).
                if pd.isna(val):
                    record[db_col] = None
                else:
                    record[db_col] = val
        
        # Ensure 'body' is set and lowercased so the frontend can query it
        if "body" not in record or record["body"] is None or str(record["body"]).strip() == "":
            record["body"] = "spacecraft"
        else:
            record["body"] = str(record["body"]).lower()
            
        records.append(record)

    return records