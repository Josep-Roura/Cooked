from fastapi import APIRouter, UploadFile, File, Form, HTTPException
import pandas as pd
from io import StringIO

from coocked_api.services.day_classifier import classify_day
from coocked_api.services.nutrition_engine import nutrition_targets

router = APIRouter()


def normalize_tp_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Accepts either:
    - workouts_mvp.csv (already normalized)
    - raw TrainingPeaks export (workouts.csv)

    Normalizes columns to at least:
    - workout_day (str)
    - planned_hours (float)
    """
    # Already MVP format
    if {"workout_day", "planned_hours"}.issubset(df.columns):
        return df

    rename_map = {
        "WorkoutDay": "workout_day",
        "PlannedDuration": "planned_hours",          # hours
        "PlannedDistanceInMeters": "planned_dist_m",
        "TimeTotalInHours": "actual_hours",
        "DistanceInMeters": "actual_dist_m",
    }

    df = df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns})

    if "planned_dist_m" in df.columns:
        df["planned_km"] = pd.to_numeric(df["planned_dist_m"], errors="coerce") / 1000.0

    if "actual_dist_m" in df.columns:
        df["actual_km"] = pd.to_numeric(df["actual_dist_m"], errors="coerce") / 1000.0

    if "planned_hours" in df.columns:
        df["planned_hours"] = (
            pd.to_numeric(df["planned_hours"], errors="coerce")
            .fillna(0.0)
        )

    if "workout_day" in df.columns:
        df["workout_day"] = df["workout_day"].astype(str)

    return df


@router.post("/plan/nutrition")
async def plan_nutrition(
    file: UploadFile = File(...),
    weight_kg: float = Form(...)
):
    if weight_kg <= 0:
        raise HTTPException(status_code=400, detail="weight_kg must be > 0")

    contents = await file.read()

    try:
        df = pd.read_csv(StringIO(contents.decode("utf-8-sig")))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV file: {e}")

    # 🔑 Normalize raw or MVP CSV
    df = normalize_tp_columns(df)

    # Validate required columns
    required = {"workout_day", "planned_hours"}
    missing = required - set(df.columns)
    if missing:
        raise HTTPException(
            status_code=400,
            detail=(
                f"CSV missing required columns: {sorted(list(missing))}. "
                f"Got columns: {list(df.columns)}"
            ),
        )

    rows = []

    for _, row in df.iterrows():
        planned_hours = float(row.get("planned_hours", 0.0))
        day_type = classify_day(planned_hours)

        targets = nutrition_targets(
            weight_kg=weight_kg,
            day_type=day_type,
            planned_hours=planned_hours,
        )

        rows.append(
            {
                "date": row["workout_day"],
                "day_type": day_type,
                "kcal": targets["kcal"],
                "protein_g": targets["protein_g"],
                "carbs_g": targets["carbs_g"],
                "fat_g": targets["fat_g"],
                "intra_cho_g_per_h": targets["intra_cho_g_per_h"],
            }
        )

    return {
        "weight_kg": weight_kg,
        "rows": rows,
    }
