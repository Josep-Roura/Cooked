from __future__ import annotations

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt


def load_tp_csv(path) -> pd.DataFrame:
    # utf-8-sig helps with BOM from some exports
    return pd.read_csv(path, encoding="utf-8-sig")


def safe_numeric(s: pd.Series) -> pd.Series:
    if s is None:
        return s
    if s.dtype == "O":
        s = (
            s.astype(str)
            .str.replace(",", ".", regex=False)
            .replace({"nan": np.nan, "None": np.nan, "": np.nan})
        )
    return pd.to_numeric(s, errors="coerce")


def to_datetime(s: pd.Series) -> pd.Series:
    return pd.to_datetime(s, errors="coerce")


def parse_tp_df(df: pd.DataFrame) -> pd.DataFrame:
    """
    IMPORTANT:
    - Does NOT drop columns.
    - Only parses types on known TrainingPeaks fields.
    """
    df = df.copy()
    df.columns = [c.strip() for c in df.columns]

    if "WorkoutDay" in df.columns:
        df["WorkoutDay"] = to_datetime(df["WorkoutDay"]).dt.date

    # planned
    if "PlannedDuration" in df.columns:
        df["PlannedDuration"] = safe_numeric(df["PlannedDuration"])  # hours in your export
    if "PlannedDistanceInMeters" in df.columns:
        df["PlannedDistanceInMeters"] = safe_numeric(df["PlannedDistanceInMeters"])

    # actual
    if "TimeTotalInHours" in df.columns:
        df["TimeTotalInHours"] = safe_numeric(df["TimeTotalInHours"])  # hours
    if "DistanceInMeters" in df.columns:
        df["DistanceInMeters"] = safe_numeric(df["DistanceInMeters"])

    # optional metrics
    for col in ["IF", "TSS", "PowerAverage", "HeartRateAverage", "Rpe", "Feeling"]:
        if col in df.columns:
            df[col] = safe_numeric(df[col])

    return df


def build_mvp_dataset(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build MVP schema from either:
    - raw TrainingPeaks export columns
    - already-normalized columns
    """

    def first_existing(*names):
        for n in names:
            if n in df.columns:
                return n
        return None

    out = pd.DataFrame()

    # Date
    day_col = first_existing("workout_day", "WorkoutDay")
    out["workout_day"] = pd.to_datetime(df[day_col], errors="coerce").dt.date if day_col else pd.NaT

    # Type + title + text
    out["workout_type"] = df[first_existing("workout_type", "WorkoutType")] if first_existing("workout_type", "WorkoutType") else None
    out["title"] = df[first_existing("title", "Title")] if first_existing("title", "Title") else None
    out["description"] = df[first_existing("description", "WorkoutDescription")] if first_existing("description", "WorkoutDescription") else None
    out["coach_comments"] = df[first_existing("coach_comments", "CoachComments")] if first_existing("coach_comments", "CoachComments") else None
    out["athlete_comments"] = df[first_existing("athlete_comments", "AthleteComments")] if first_existing("athlete_comments", "AthleteComments") else None

    # Planned
    planned_h_col = first_existing("planned_hours", "PlannedDuration")
    out["planned_hours"] = safe_numeric(df[planned_h_col]) if planned_h_col else np.nan

    planned_m_col = first_existing("planned_km", "PlannedDistanceInMeters")
    if planned_m_col == "PlannedDistanceInMeters":
        out["planned_km"] = safe_numeric(df[planned_m_col]) / 1000.0
    else:
        out["planned_km"] = safe_numeric(df[planned_m_col]) if planned_m_col else np.nan

    # Actual
    actual_h_col = first_existing("actual_hours", "TimeTotalInHours")
    out["actual_hours"] = safe_numeric(df[actual_h_col]) if actual_h_col else np.nan

    actual_m_col = first_existing("actual_km", "DistanceInMeters")
    if actual_m_col == "DistanceInMeters":
        out["actual_km"] = safe_numeric(df[actual_m_col]) / 1000.0
    else:
        out["actual_km"] = safe_numeric(df[actual_m_col]) if actual_m_col else np.nan

    # Metrics
    out["if"] = safe_numeric(df[first_existing("if", "IF")]) if first_existing("if", "IF") else np.nan
    out["tss"] = safe_numeric(df[first_existing("tss", "TSS")]) if first_existing("tss", "TSS") else np.nan
    out["power_avg"] = safe_numeric(df[first_existing("power_avg", "PowerAverage")]) if first_existing("power_avg", "PowerAverage") else np.nan
    out["hr_avg"] = safe_numeric(df[first_existing("hr_avg", "HeartRateAverage")]) if first_existing("hr_avg", "HeartRateAverage") else np.nan
    out["rpe"] = safe_numeric(df[first_existing("rpe", "Rpe")]) if first_existing("rpe", "Rpe") else np.nan
    out["feeling"] = safe_numeric(df[first_existing("feeling", "Feeling")]) if first_existing("feeling", "Feeling") else np.nan

    # Derived
    out["has_actual"] = (
        (~out["actual_hours"].isna()) | (~out["actual_km"].isna()) | (~out["tss"].isna())
    )
    dt = pd.to_datetime(out["workout_day"], errors="coerce")
    out["week"] = dt.dt.to_period("W").astype(str)
    out["dow"] = dt.dt.day_name()
    return out


def aggregate_daily(mvp: pd.DataFrame) -> pd.DataFrame:
    return (
        mvp.groupby("workout_day", dropna=False)
        .agg(
            planned_hours=("planned_hours", "sum"),
            planned_km=("planned_km", "sum"),
            actual_hours=("actual_hours", "sum"),
            actual_km=("actual_km", "sum"),
            tss=("tss", "sum"),
            workouts=("title", "count"),
        )
        .reset_index()
        .sort_values("workout_day")
    )


def aggregate_weekly(mvp: pd.DataFrame) -> pd.DataFrame:
    return (
        mvp.groupby("week", dropna=False)
        .agg(
            planned_hours=("planned_hours", "sum"),
            planned_km=("planned_km", "sum"),
            actual_hours=("actual_hours", "sum"),
            actual_km=("actual_km", "sum"),
            tss=("tss", "sum"),
            workouts=("title", "count"),
        )
        .reset_index()
    )


def plot_weekly_hours(weekly: pd.DataFrame, outpath: str) -> None:
    fig = plt.figure()
    x = np.arange(len(weekly))
    plt.plot(x, weekly["planned_hours"].fillna(0), marker="o", label="Planned hours")
    if "actual_hours" in weekly.columns and weekly["actual_hours"].notna().any():
        plt.plot(x, weekly["actual_hours"].fillna(0), marker="o", label="Actual hours")
    plt.xticks(x, weekly["week"], rotation=45, ha="right")
    plt.title("Weekly Hours")
    plt.xlabel("Week")
    plt.ylabel("Hours")
    plt.legend()
    plt.tight_layout()
    fig.savefig(outpath, dpi=160)
    plt.close(fig)


def plot_weekly_distance(weekly: pd.DataFrame, outpath: str) -> None:
    fig = plt.figure()
    x = np.arange(len(weekly))
    plt.plot(x, weekly["planned_km"].fillna(0), marker="o", label="Planned KM")
    if "actual_km" in weekly.columns and weekly["actual_km"].notna().any():
        plt.plot(x, weekly["actual_km"].fillna(0), marker="o", label="Actual KM")
    plt.xticks(x, weekly["week"], rotation=45, ha="right")
    plt.title("Weekly Distance")
    plt.xlabel("Week")
    plt.ylabel("Kilometers")
    plt.legend()
    plt.tight_layout()
    fig.savefig(outpath, dpi=160)
    plt.close(fig)


def plot_workouts_by_type(mvp: pd.DataFrame, outpath: str) -> None:
    fig = plt.figure()
    counts = mvp["workout_type"].fillna("Unknown").value_counts().sort_values(ascending=False)
    plt.bar(counts.index.astype(str), counts.values)
    plt.title("Workouts by Type")
    plt.xlabel("Workout Type")
    plt.ylabel("Count")
    plt.xticks(rotation=30, ha="right")
    plt.tight_layout()
    fig.savefig(outpath, dpi=160)
    plt.close(fig)


def plot_calendar_heatmap(daily: pd.DataFrame, outpath: str) -> None:
    d = daily.copy()
    d["workout_day"] = pd.to_datetime(d["workout_day"], errors="coerce")
    d["week_start"] = d["workout_day"].dt.to_period("W").apply(lambda r: r.start_time)
    d["weekday"] = d["workout_day"].dt.weekday  # Mon=0

    pivot = d.pivot_table(
        index="week_start",
        columns="weekday",
        values="planned_hours",
        aggfunc="sum"
    ).fillna(0.0)

    fig = plt.figure()
    plt.imshow(pivot.values, aspect="auto")
    plt.title("Training Calendar Heatmap")
    plt.xlabel("Weekday")
    plt.ylabel("Week start")
    plt.yticks(np.arange(len(pivot.index)), [dt.strftime("%Y-%m-%d") for dt in pivot.index])
    plt.xticks(np.arange(7), ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
    cbar = plt.colorbar()
    cbar.set_label("Planned Hours")
    plt.tight_layout()
    fig.savefig(outpath, dpi=160)
    plt.close(fig)
