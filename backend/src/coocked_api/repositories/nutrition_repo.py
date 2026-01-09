from __future__ import annotations

from collections import Counter
from typing import Any

from coocked_api.infra.supabase_client import get_supabase


PlanRowPayload = dict[str, Any]


def create_plan(
    user_key: str,
    source_filename: str | None,
    weight_kg: float,
    rows: list[PlanRowPayload],
) -> str:
    if not rows:
        raise ValueError("Cannot save an empty plan.")

    dates = [row["date"] for row in rows]
    start_date = min(dates)
    end_date = max(dates)

    supabase = get_supabase()
    plan_payload = {
        "user_key": user_key,
        "source_filename": source_filename,
        "weight_kg": weight_kg,
        "start_date": start_date,
        "end_date": end_date,
    }

    plan_result = supabase.table("nutrition_plans").insert(plan_payload).execute()
    plan_id = plan_result.data[0]["id"]

    row_payloads = [
        {
            "plan_id": plan_id,
            "date": row["date"],
            "day_type": row["day_type"],
            "kcal": row["kcal"],
            "protein_g": row["protein_g"],
            "carbs_g": row["carbs_g"],
            "fat_g": row["fat_g"],
            "intra_cho_g_per_h": row["intra_cho_g_per_h"],
        }
        for row in rows
    ]

    supabase.table("nutrition_plan_rows").insert(row_payloads).execute()
    return plan_id


def list_plans(
    user_key: str,
    limit: int = 20,
    offset: int = 0,
) -> list[dict[str, Any]]:
    supabase = get_supabase()
    plan_result = (
        supabase.table("nutrition_plans")
        .select("id, created_at, start_date, end_date, weight_kg, source_filename")
        .eq("user_key", user_key)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    plans = plan_result.data or []

    plan_ids = [plan["id"] for plan in plans]
    row_count_map: dict[str, int] = {}

    if plan_ids:
        rows_result = (
            supabase.table("nutrition_plan_rows")
            .select("plan_id")
            .in_("plan_id", plan_ids)
            .execute()
        )
        row_counts = Counter(row["plan_id"] for row in (rows_result.data or []))
        row_count_map = dict(row_counts)

    for plan in plans:
        plan["row_count"] = row_count_map.get(plan["id"], 0)

    return plans


def get_plan(plan_id: str, user_key: str) -> dict[str, Any] | None:
    supabase = get_supabase()
    plan_result = (
        supabase.table("nutrition_plans")
        .select("id, created_at, start_date, end_date, weight_kg, source_filename")
        .eq("id", plan_id)
        .eq("user_key", user_key)
        .execute()
    )
    if not plan_result.data:
        return None

    plan = plan_result.data[0]
    rows_result = (
        supabase.table("nutrition_plan_rows")
        .select(
            "date, day_type, kcal, protein_g, carbs_g, fat_g, intra_cho_g_per_h"
        )
        .eq("plan_id", plan_id)
        .order("date", desc=False)
        .execute()
    )

    plan["rows"] = rows_result.data or []
    plan["row_count"] = len(plan["rows"])
    return plan
