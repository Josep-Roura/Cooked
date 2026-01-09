# tp_mvp_extract.py
# Usage:
#   python tp_mvp_extract.py --input "/ruta/TrainingPeaks.csv" --outdir "./out"
#
# Creates:
#   out/workouts_raw_parsed.csv         (raw but parsed)
#   out/workouts_mvp.csv                (MVP-clean dataset)
#   out/summary_by_week.csv             (weekly aggregates)
#   out/summary_by_day.csv              (daily aggregates)
#   out/plot_weekly_hours.png
#   out/plot_weekly_distance.png
#   out/plot_workouts_by_type.png
#   out/plot_calendar_heatmap.png

import argparse
import os
from dataclasses import dataclass
from typing import Optional, List

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt


# ----------------------------
# Helpers
# ----------------------------

def ensure_outdir(outdir: str) -> None:
    os.makedirs(outdir, exist_ok=True)


def safe_numeric(s: pd.Series) -> pd.Series:
    """Convert series to numeric safely (handles commas, blanks)."""
    if s is None:
        return s
    if s.dtype == "O":
        s = s.astype(str).str.replace(",", ".", regex=False).replace({"nan": np.nan, "None": np.nan, "": np.nan})
    return pd.to_numeric(s, errors="coerce")


def normalize_workout_type(s: pd.Series) -> pd.Series:
    """Normalize common TrainingPeaks workout types."""
    if s is None:
        return s
    s = s.astype(str).str.strip()
    mapping = {
        "Bike": "Bike",
        "Run": "Run",
        "Swim": "Swim",
        "Strength": "Strength",
        "Other": "Other",
    }
    return s.map(lambda x: mapping.get(x, x))


def to_datetime_utc_naive(s: pd.Series) -> pd.Series:
    """Parse dates like YYYY-MM-DD into datetime (naive)."""
    return pd.to_datetime(s, errors="coerce")


def km_from_meters(m: pd.Series) -> pd.Series:
    m = safe_numeric(m)
    return m / 1000.0


def hours_from_hours(h: pd.Series) -> pd.Series:
    """Already in hours in this export (PlannedDuration / TimeTotalInHours)."""
    return safe_numeric(h)


def pick_first_nonnull(*values):
    for v in values:
        if v is not None:
            return v
    return None


# ----------------------------
# Core extraction
# ----------------------------

@dataclass
class MVPConfig:
    # Columns we want to keep for MVP (if they exist)
    keep_cols: List[str] = None

    def __post_init__(self):
        if self.keep_cols is None:
            self.keep_cols = [
                "workout_day",
                "workout_type",
                "title",
                "description",
                "planned_hours",
                "planned_km",
                "actual_hours",
                "actual_km",
                "if",
                "tss",
                "power_avg",
                "hr_avg",
                "rpe",
                "feeling",
                "coach_comments",
                "athlete_comments",
            ]


def load_and_parse(input_path: str) -> pd.DataFrame:
    df = pd.read_csv(input_path)

    # Normalize column names (strip spaces)
    df.columns = [c.strip() for c in df.columns]

    # Parse key columns (your export has these names)
    # Date
    if "WorkoutDay" in df.columns:
        df["WorkoutDay"] = to_datetime_utc_naive(df["WorkoutDay"])

    # Numerics (planned + actual)
    if "PlannedDuration" in df.columns:
        df["PlannedDuration"] = hours_from_hours(df["PlannedDuration"])
    if "TimeTotalInHours" in df.columns:
        df["TimeTotalInHours"] = hours_from_hours(df["TimeTotalInHours"])

    if "PlannedDistanceInMeters" in df.columns:
        df["PlannedDistanceInMeters"] = safe_numeric(df["PlannedDistanceInMeters"])
    if "DistanceInMeters" in df.columns:
        df["DistanceInMeters"] = safe_numeric(df["DistanceInMeters"])

    # Optional metrics
    for col in ["IF", "TSS", "PowerAverage", "HeartRateAverage", "Rpe", "Feeling"]:
        if col in df.columns:
            df[col] = safe_numeric(df[col])

    # Types
    if "WorkoutType" in df.columns:
        df["WorkoutType"] = normalize_workout_type(df["WorkoutType"])

    return df


def build_mvp_dataset(df: pd.DataFrame, cfg: MVPConfig) -> pd.DataFrame:
    # Build a clean schema for your app
    out = pd.DataFrame()

    out["workout_day"] = df["WorkoutDay"] if "WorkoutDay" in df.columns else pd.NaT
    out["workout_type"] = df["WorkoutType"] if "WorkoutType" in df.columns else None
    out["title"] = df["Title"] if "Title" in df.columns else None
    out["description"] = df["WorkoutDescription"] if "WorkoutDescription" in df.columns else None

    out["planned_hours"] = df["PlannedDuration"] if "PlannedDuration" in df.columns else np.nan
    out["planned_km"] = km_from_meters(df["PlannedDistanceInMeters"]) if "PlannedDistanceInMeters" in df.columns else np.nan

    out["actual_hours"] = df["TimeTotalInHours"] if "TimeTotalInHours" in df.columns else np.nan
    out["actual_km"] = km_from_meters(df["DistanceInMeters"]) if "DistanceInMeters" in df.columns else np.nan

    out["if"] = df["IF"] if "IF" in df.columns else np.nan
    out["tss"] = df["TSS"] if "TSS" in df.columns else np.nan
    out["power_avg"] = df["PowerAverage"] if "PowerAverage" in df.columns else np.nan
    out["hr_avg"] = df["HeartRateAverage"] if "HeartRateAverage" in df.columns else np.nan

    out["rpe"] = df["Rpe"] if "Rpe" in df.columns else np.nan
    out["feeling"] = df["Feeling"] if "Feeling" in df.columns else np.nan

    out["coach_comments"] = df["CoachComments"] if "CoachComments" in df.columns else None
    out["athlete_comments"] = df["AthleteComments"] if "AthleteComments" in df.columns else None

    # Add useful derived fields
    out["has_actual"] = (~out["actual_hours"].isna()) | (~out["actual_km"].isna()) | (~out["tss"].isna())
    out["week"] = out["workout_day"].dt.to_period("W").astype(str)
    out["dow"] = out["workout_day"].dt.day_name()

    # If only planned is present, you still have a coherent MVP dataset
    # Fill missing planned_km/hours with 0 if desired (I keep NaN to avoid lying)
    # You can change these to 0 if your pipeline prefers.
    return out[cfg.keep_cols + ["has_actual", "week", "dow"]].copy()


def aggregate_daily(mvp: pd.DataFrame) -> pd.DataFrame:
    daily = (
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
    return daily


def aggregate_weekly(mvp: pd.DataFrame) -> pd.DataFrame:
    weekly = (
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
    return weekly


# ----------------------------
# Visualizations (matplotlib only)
# ----------------------------

def plot_weekly_hours(weekly: pd.DataFrame, outpath: str) -> None:
    fig = plt.figure()
    x = np.arange(len(weekly))
    plt.plot(x, weekly["planned_hours"].fillna(0), marker="o", label="Planned hours")
    if weekly["actual_hours"].notna().any():
        plt.plot(x, weekly["actual_hours"].fillna(0), marker="o", label="Actual hours")
    plt.xticks(x, weekly["week"], rotation=45, ha="right")
    plt.title("Weekly Training Volume (Hours)")
    plt.xlabel("Week")
    plt.ylabel("Hours")
    plt.legend()
    plt.tight_layout()
    fig.savefig(outpath, dpi=160)
    plt.close(fig)


def plot_weekly_distance(weekly: pd.DataFrame, outpath: str) -> None:
    fig = plt.figure()
    x = np.arange(len(weekly))
    plt.plot(x, weekly["planned_km"].fillna(0), marker="o", label="Planned km")
    if weekly["actual_km"].notna().any():
        plt.plot(x, weekly["actual_km"].fillna(0), marker="o", label="Actual km")
    plt.xticks(x, weekly["week"], rotation=45, ha="right")
    plt.title("Weekly Training Distance (km)")
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
    plt.xlabel("Workout type")
    plt.ylabel("Count")
    plt.xticks(rotation=30, ha="right")
    plt.tight_layout()
    fig.savefig(outpath, dpi=160)
    plt.close(fig)


def plot_calendar_heatmap(daily: pd.DataFrame, outpath: str) -> None:
    """
    Simple calendar-like heatmap: planned_hours per day.
    Not a full calendar, but a matrix of (week x weekday) that is very readable.
    """
    d = daily.copy()
    d["workout_day"] = pd.to_datetime(d["workout_day"])
    d["week_start"] = d["workout_day"].dt.to_period("W").apply(lambda r: r.start_time)
    d["weekday"] = d["workout_day"].dt.weekday  # Mon=0

    pivot = d.pivot_table(
        index="week_start", columns="weekday", values="planned_hours", aggfunc="sum"
    ).fillna(0.0)

    fig = plt.figure()
    plt.imshow(pivot.values, aspect="auto")
    plt.title("Planned Hours Heatmap (Week x Weekday)")
    plt.xlabel("Weekday (Mon=0 ... Sun=6)")
    plt.ylabel("Week start")
    plt.yticks(np.arange(len(pivot.index)), [dt.strftime("%Y-%m-%d") for dt in pivot.index])
    plt.xticks(np.arange(7), ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
    plt.tight_layout()
    fig.savefig(outpath, dpi=160)
    plt.close(fig)


# ----------------------------
# Main
# ----------------------------

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to TrainingPeaks CSV export")
    parser.add_argument("--outdir", default="./out", help="Output directory")
    args = parser.parse_args()

    ensure_outdir(args.outdir)

    df = load_and_parse(args.input)
    df.to_csv(os.path.join(args.outdir, "workouts_raw_parsed.csv"), index=False)

    cfg = MVPConfig()
    mvp = build_mvp_dataset(df, cfg)
    mvp.to_csv(os.path.join(args.outdir, "workouts_mvp.csv"), index=False)

    daily = aggregate_daily(mvp)
    weekly = aggregate_weekly(mvp)

    daily.to_csv(os.path.join(args.outdir, "summary_by_day.csv"), index=False)
    weekly.to_csv(os.path.join(args.outdir, "summary_by_week.csv"), index=False)

    plot_weekly_hours(weekly, os.path.join(args.outdir, "plot_weekly_hours.png"))
    plot_weekly_distance(weekly, os.path.join(args.outdir, "plot_weekly_distance.png"))
    plot_workouts_by_type(mvp, os.path.join(args.outdir, "plot_workouts_by_type.png"))
    plot_calendar_heatmap(daily, os.path.join(args.outdir, "plot_calendar_heatmap.png"))

    print("Done ✅")
    print(f"Outputs saved to: {os.path.abspath(args.outdir)}")


if __name__ == "__main__":
    main()
