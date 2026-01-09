from __future__ import annotations

from pathlib import Path
from typing import Iterable

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

RAW_COLUMNS = {
    "workout_day": ["WorkoutDay"],
    "workout_type": ["WorkoutType"],
    "title": ["Title"],
    "description": ["WorkoutDescription"],
    "planned_hours": ["PlannedDuration (hours)", "PlannedDurationHours"],
    "planned_meters": ["PlannedDistanceInMeters"],
    "actual_hours": ["TimeTotalInHours"],
    "actual_meters": ["DistanceInMeters"],
    "if": ["IF"],
    "tss": ["TSS"],
    "power_avg": ["PowerAverage"],
    "hr_avg": ["HeartRateAverage"],
    "rpe": ["Rpe"],
    "feeling": ["Feeling"],
    "coach_comments": ["CoachComments"],
    "athlete_comments": ["AthleteComments"],
}

MVP_COLUMNS = {
    "workout_day": ["workout_day", "workoutday", "date", "day"],
    "workout_type": ["workout_type", "workouttype", "type"],
    "title": ["title"],
    "description": ["description", "workout_description"],
    "coach_comments": ["coach_comments", "coachcomments"],
    "athlete_comments": ["athlete_comments", "athletecomments"],
    "planned_hours": ["planned_hours", "plannedhours"],
    "planned_km": ["planned_km", "plannedkm"],
    "actual_hours": ["actual_hours", "actualhours"],
    "actual_km": ["actual_km", "actualkm"],
    "if": ["if"],
    "tss": ["tss"],
    "power_avg": ["power_avg", "poweraverage"],
    "hr_avg": ["hr_avg", "heartrateaverage"],
    "rpe": ["rpe"],
    "feeling": ["feeling"],
    "source": ["source"],
}


def _simplify(name: str) -> str:
    return "".join(ch for ch in name.lower() if ch.isalnum())


def _get_column(columns: Iterable[str], candidates: Iterable[str]) -> str | None:
    simplified = {_simplify(col): col for col in columns}
    for candidate in candidates:
        match = simplified.get(_simplify(candidate))
        if match:
            return match
    return None


def safe_numeric(values: pd.Series | float | int | None) -> pd.Series | float | None:
    if values is None:
        return None
    if isinstance(values, pd.Series):
        return pd.to_numeric(values, errors="coerce")
    return pd.to_numeric(pd.Series([values]), errors="coerce").iloc[0]


def to_datetime(values: pd.Series | str | None) -> pd.Series | pd.Timestamp | None:
    if values is None:
        return None
    if isinstance(values, pd.Series):
        return pd.to_datetime(values, errors="coerce")
    return pd.to_datetime(values, errors="coerce")


def normalize_workout_type(value: str | None) -> str | None:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return None
    text = str(value).strip()
    if not text:
        return None
    return text.title()


def load_tp_csv(path: str | Path) -> pd.DataFrame:
    return pd.read_csv(path, encoding="utf-8-sig")


def parse_tp_df(df: pd.DataFrame) -> pd.DataFrame:
    columns = list(df.columns)
    mvp_detection_keys = [
        MVP_COLUMNS[\"workout_day\"],
        MVP_COLUMNS[\"planned_hours\"],
        MVP_COLUMNS[\"planned_km\"],
        MVP_COLUMNS[\"actual_hours\"],
        MVP_COLUMNS[\"actual_km\"],
    ]
    has_mvp = any(_get_column(columns, candidates) for candidates in mvp_detection_keys)

    if has_mvp:
        data = {}
        for key, candidates in MVP_COLUMNS.items():
            column = _get_column(columns, candidates)
            if column:
                data[key] = df[column]
        return pd.DataFrame(data)

    data = {}
    for key, candidates in RAW_COLUMNS.items():
        column = _get_column(columns, candidates)
        if column:
            data[key] = df[column]
    return pd.DataFrame(data)


def build_mvp_dataset(df: pd.DataFrame, cfg: dict | None = None) -> pd.DataFrame:
    parsed = parse_tp_df(df)

    workout_day = to_datetime(parsed.get("workout_day"))
    if isinstance(workout_day, pd.Series):
        workout_day = workout_day.dt.date

    planned_hours = safe_numeric(parsed.get("planned_hours"))
    actual_hours = safe_numeric(parsed.get("actual_hours"))

    planned_km = safe_numeric(parsed.get("planned_km"))
    actual_km = safe_numeric(parsed.get("actual_km"))

    planned_meters = safe_numeric(parsed.get("planned_meters"))
    actual_meters = safe_numeric(parsed.get("actual_meters"))

    if planned_km is None and planned_meters is not None:
        planned_km = planned_meters / 1000
    if actual_km is None and actual_meters is not None:
        actual_km = actual_meters / 1000

    if parsed.get("workout_type") is not None:
        workout_type = parsed.get("workout_type").apply(normalize_workout_type)
    else:
        workout_type = None

    if_series = safe_numeric(parsed.get("if"))
    tss = safe_numeric(parsed.get("tss"))
    power_avg = safe_numeric(parsed.get("power_avg"))
    hr_avg = safe_numeric(parsed.get("hr_avg"))
    rpe = safe_numeric(parsed.get("rpe"))
    feeling = safe_numeric(parsed.get("feeling"))

    if isinstance(workout_day, pd.Series):
        day_series = pd.to_datetime(workout_day, errors="coerce")
        iso = day_series.dt.isocalendar()
        week = iso.year.astype(str) + "-W" + iso.week.astype(str).str.zfill(2)
        dow = day_series.dt.day_name()
    else:
        week = None
        dow = None

    has_actual = False
    if isinstance(actual_hours, pd.Series) or isinstance(actual_km, pd.Series):
        actual_hours_present = (
            actual_hours.notna() if isinstance(actual_hours, pd.Series) else False
        )
        actual_km_present = (
            actual_km.notna() if isinstance(actual_km, pd.Series) else False
        )
        has_actual = actual_hours_present | actual_km_present

    source = parsed.get("source") if parsed.get("source") is not None else "trainingpeaks_export"

    output = pd.DataFrame(
        {
            "workout_day": workout_day,
            "workout_type": workout_type,
            "title": parsed.get("title"),
            "description": parsed.get("description"),
            "coach_comments": parsed.get("coach_comments"),
            "athlete_comments": parsed.get("athlete_comments"),
            "planned_hours": planned_hours,
            "planned_km": planned_km,
            "actual_hours": actual_hours,
            "actual_km": actual_km,
            "if": if_series,
            "tss": tss,
            "power_avg": power_avg,
            "hr_avg": hr_avg,
            "rpe": rpe,
            "feeling": feeling,
            "has_actual": has_actual,
            "week": week,
            "dow": dow,
            "source": source,
        }
    )
    return output


def _aggregate(df: pd.DataFrame, group_field: str) -> pd.DataFrame:
    sum_fields = [
        "planned_hours",
        "planned_km",
        "actual_hours",
        "actual_km",
        "tss",
    ]
    mean_fields = ["if", "power_avg", "hr_avg", "rpe", "feeling"]
    agg_map = {field: "sum" for field in sum_fields if field in df.columns}
    agg_map.update({field: "mean" for field in mean_fields if field in df.columns})

    grouped = df.groupby(group_field, dropna=False).agg(agg_map)
    grouped["workouts_count"] = df.groupby(group_field, dropna=False).size()
    return grouped.reset_index()


def aggregate_daily(mvp: pd.DataFrame) -> pd.DataFrame:
    return _aggregate(mvp, "workout_day")


def aggregate_weekly(mvp: pd.DataFrame) -> pd.DataFrame:
    return _aggregate(mvp, "week")


def plot_weekly_hours(mvp: pd.DataFrame, output_path: str | Path) -> None:
    weekly = aggregate_weekly(mvp)
    plt.figure(figsize=(10, 4))
    if "planned_hours" in weekly.columns:
        plt.plot(weekly["week"], weekly["planned_hours"], label="Planned Hours")
    if "actual_hours" in weekly.columns:
        plt.plot(weekly["week"], weekly["actual_hours"], label="Actual Hours")
    plt.title("Weekly Hours")
    plt.xlabel("Week")
    plt.ylabel("Hours")
    plt.xticks(rotation=45, ha="right")
    plt.legend()
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()


def plot_weekly_distance(mvp: pd.DataFrame, output_path: str | Path) -> None:
    weekly = aggregate_weekly(mvp)
    plt.figure(figsize=(10, 4))
    if "planned_km" in weekly.columns:
        plt.plot(weekly["week"], weekly["planned_km"], label="Planned KM")
    if "actual_km" in weekly.columns:
        plt.plot(weekly["week"], weekly["actual_km"], label="Actual KM")
    plt.title("Weekly Distance")
    plt.xlabel("Week")
    plt.ylabel("Kilometers")
    plt.xticks(rotation=45, ha="right")
    plt.legend()
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()


def plot_workouts_by_type(mvp: pd.DataFrame, output_path: str | Path) -> None:
    counts = mvp["workout_type"].fillna("Unknown").value_counts()
    plt.figure(figsize=(8, 4))
    counts.plot(kind="bar")
    plt.title("Workouts by Type")
    plt.xlabel("Workout Type")
    plt.ylabel("Count")
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()


def plot_calendar_heatmap(mvp: pd.DataFrame, output_path: str | Path) -> None:
    if "workout_day" not in mvp.columns:
        return

    day_series = pd.to_datetime(mvp["workout_day"], errors="coerce")
    week_start = day_series - pd.to_timedelta(day_series.dt.weekday, unit="D")
    dow_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    data = mvp.copy()
    data["week_start"] = week_start.dt.date
    data["dow"] = day_series.dt.day_name()
    data["actual_hours"] = safe_numeric(data.get("actual_hours"))

    pivot = (
        data.pivot_table(
            index="week_start",
            columns="dow",
            values="actual_hours",
            aggfunc="sum",
        )
        .reindex(columns=dow_order)
        .fillna(0)
    )

    plt.figure(figsize=(10, 5))
    plt.imshow(pivot.values, aspect="auto", cmap="YlGnBu")
    plt.colorbar(label="Actual Hours")
    plt.yticks(range(len(pivot.index)), pivot.index)
    plt.xticks(range(len(dow_order)), dow_order, rotation=45, ha="right")
    plt.title("Training Calendar Heatmap")
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()
