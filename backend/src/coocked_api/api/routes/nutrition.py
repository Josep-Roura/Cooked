from __future__ import annotations

import io
import pandas as pd
from fastapi import APIRouter, File, Form, UploadFile, HTTPException

from coocked_api.services.day_classifier import classify_day
from coocked_api.services.nutrition_engine import nutrition_targets

router = APIRouter(tags=["nutrition"])


@router.post("/plan/nutrition")
async def plan_nutrition(
    file: UploadFile = File(...),
    weight_kg: float = Form(...),
):
    if weight_kg <= 0 or weight_kg > 250:
        raise HTTPException(status_code=400, detail="weight_kg must be a realistic positive number")

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file")

    content = await file.read()

    try:
        df = pd.read_csv(io.BytesIO(content), encoding="utf-8-sig")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read CSV: {e}")

    # Minimum columns expected from workouts_mvp.csv
    required = {"workout_day", "planned_hours"}
    missing = required - set(df.columns)
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"CSV missing required columns: {sorted(list(missing))}. "
                   f"Expected workouts_mvp.csv output.",
        )

    out_rows = []
    for _, row in df.iterrows():
        planned_hours = row.get("planned_hours")
        try:
            planned_hours = float(planned_hours) if pd.notna(planned_hours) else 0.0
        except Exception:
            planned_hours = 0.0

        day_type = classify_day(planned_hours)
        targets = nutrition_targets(weight_kg=weight_kg, day_type=day_type, planned_hours=planned_hours)

        out_rows.append({
            "date": str(row.get("workout_day")),
            "day_type": day_type,
            **targets,
        })

    return {"weight_kg": weight_kg, "rows": out_rows}
