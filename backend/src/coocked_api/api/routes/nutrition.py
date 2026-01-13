from __future__ import annotations

import io
import os

import pandas as pd
from fastapi import APIRouter, File, Form, Header, HTTPException, Query, UploadFile

from coocked_api.repositories.nutrition_repo import create_plan, get_plan, list_plans
from coocked_api.services.day_classifier import classify_day
from coocked_api.services.nutrition_engine import nutrition_targets
from coocked_api.services.tp_normalize import normalize_and_aggregate_tp_df
from coocked_api.services.auth import get_user_id_from_authorization

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


def _require_device_id(device_id: str | None) -> str:
    if not device_id:
        raise HTTPException(status_code=400, detail="Missing x-device-id")
    return device_id


def _supabase_enabled() -> bool:
    return bool(os.getenv("SUPABASE_URL")) and bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY"))


@router.post("/plan/nutrition")
async def plan_nutrition(
    file: UploadFile = File(...),

    weight_kg: float = Form(...),
    authorization: str | None = Header(default=None, alias="Authorization"),
):
    # Extract user id from Authorization header
    user_id = get_user_id_from_authorization(authorization)

    if weight_kg <= 0 or weight_kg > 250:
        raise HTTPException(
            status_code=400, detail="weight_kg must be a realistic positive number"
        )

    contents = await file.read()

    try:
        # handle BOM and in-memory bytes
        df = pd.read_csv(io.StringIO(contents.decode("utf-8-sig")))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV file: {e}")

    daily_df = normalize_and_aggregate_tp_df(df)

    out_rows = []
    for _, row in daily_df.iterrows():
        planned_hours = row.get("planned_hours", 0.0)
        try:
            planned_hours = float(planned_hours) if pd.notna(planned_hours) else 0.0
        except Exception:
            planned_hours = 0.0
        if planned_hours <= 0:
            planned_hours = 0.0

        day_type = classify_day(planned_hours)
        targets = nutrition_targets(
            weight_kg=weight_kg, day_type=day_type, planned_hours=planned_hours
        )

        date_value = row.get("date")
        date_str = date_value.isoformat() if hasattr(date_value, "isoformat") else str(date_value)

        out_rows.append({
            "date": date_str,
            "day_type": day_type,
            **targets,
        })

    response = {"plan_id": None, "saved": False, "weight_kg": weight_kg, "rows": out_rows}

    if _supabase_enabled() and out_rows:
        try:
            plan_id = create_plan(
                user_id=user_id,
                source_filename=file.filename,
                weight_kg=weight_kg,
                rows=out_rows,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save plan: {e}")
        response["plan_id"] = plan_id
        response["saved"] = True

    return response


@router.get("/plans")
async def list_saved_plans(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    authorization: str | None = Header(default=None, alias="Authorization"),
):
    user_id = get_user_id_from_authorization(authorization)
    if not _supabase_enabled():
        raise HTTPException(status_code=503, detail="Supabase not configured")

    try:
        plans = list_plans(user_id=user_id, limit=limit, offset=offset)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list plans: {e}")

    return {"plans": plans, "limit": limit, "offset": offset}


@router.get("/plans/{plan_id}")
async def get_saved_plan(
    plan_id: str,
    authorization: str | None = Header(default=None, alias="Authorization"),
):
    user_id = get_user_id_from_authorization(authorization)
    if not _supabase_enabled():
        raise HTTPException(status_code=503, detail="Supabase not configured")

    try:
        plan = get_plan(plan_id=plan_id, user_id=user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch plan: {e}")

    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")

    return plan
