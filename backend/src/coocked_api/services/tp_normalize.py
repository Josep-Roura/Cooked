from __future__ import annotations

import pandas as pd

from coocked_api.utils.tp_parsing import build_mvp_dataset


REQUIRED_COLUMNS = {"workout_day", "planned_hours"}


def normalize_and_aggregate_tp_df(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalize a TrainingPeaks or MVP-style dataframe and aggregate planned hours by day.

    Returns a dataframe with columns: [date, planned_hours]
    """
    if df is None or df.empty:
        return pd.DataFrame(columns=["date", "planned_hours"])

    df = df.copy()
    df.columns = [c.strip() for c in df.columns]

    if not REQUIRED_COLUMNS.issubset(df.columns):
        mvp = build_mvp_dataset(df)
    else:
        mvp = df

    daily = pd.DataFrame()
    daily["date"] = pd.to_datetime(mvp["workout_day"], errors="coerce").dt.date
    daily["planned_hours"] = pd.to_numeric(
        mvp["planned_hours"], errors="coerce"
    ).fillna(0.0)

    daily = daily.dropna(subset=["date"])
    daily = (
        daily.groupby("date", dropna=False)["planned_hours"]
        .sum()
        .reset_index()
        .sort_values("date")
        .reset_index(drop=True)
    )

    return daily
