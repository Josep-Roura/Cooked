#!/usr/bin/env python
from __future__ import annotations

import argparse
from pathlib import Path

from coocked_api.utils.tp_parsing import (
    aggregate_daily,
    aggregate_weekly,
    build_mvp_dataset,
    load_tp_csv,
    parse_tp_df,
    plot_calendar_heatmap,
    plot_weekly_distance,
    plot_weekly_hours,
    plot_workouts_by_type,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Parse TrainingPeaks CSV and generate MVP outputs.")
    parser.add_argument("--input", required=True, help="Path to TrainingPeaks CSV export.")
    parser.add_argument("--outdir", default="out", help="Output directory (default: backend/out).")
    args = parser.parse_args()

    input_path = Path(args.input)
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    print(f"Loading CSV: {input_path}")
    df = load_tp_csv(input_path)

    print("Parsing raw data...")
    raw_parsed = parse_tp_df(df)
    raw_parsed.to_csv(outdir / "workouts_raw_parsed.csv", index=False)

    print("Building MVP dataset...")
    mvp = build_mvp_dataset(raw_parsed)
    mvp.to_csv(outdir / "workouts_mvp.csv", index=False)

    if mvp["planned_hours"].notna().sum() == 0:
        raise RuntimeError(
            "planned_hours is ALL NaN. Your CSV likely has PlannedDuration but it wasn't mapped."
        )

    print("Aggregating summaries...")
    daily = aggregate_daily(mvp)
    weekly = aggregate_weekly(mvp)
    daily.to_csv(outdir / "summary_by_day.csv", index=False)
    weekly.to_csv(outdir / "summary_by_week.csv", index=False)

    print("Generating plots...")
    plot_weekly_hours(weekly, str(outdir / "plot_weekly_hours.png"))
    plot_weekly_distance(weekly, str(outdir / "plot_weekly_distance.png"))
    plot_workouts_by_type(mvp, str(outdir / "plot_workouts_by_type.png"))
    plot_calendar_heatmap(daily, str(outdir / "plot_calendar_heatmap.png"))

    print(f"Done. Outputs saved to {outdir}")


if __name__ == "__main__":
    main()
