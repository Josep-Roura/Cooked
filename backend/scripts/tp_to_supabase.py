#!/usr/bin/env python
from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

from coocked_api.config import Settings
from coocked_api.db.supabase_client import get_supabase_client
from coocked_api.utils.tp_parsing import build_mvp_dataset, load_tp_csv


def chunked(items: list[dict], batch_size: int) -> list[list[dict]]:
    return [items[i : i + batch_size] for i in range(0, len(items), batch_size)]


def main() -> None:
    parser = argparse.ArgumentParser(description="Upsert TrainingPeaks workouts into Supabase.")
    parser.add_argument("--input", required=True, help="Path to TrainingPeaks CSV export.")
    parser.add_argument("--athlete_id", required=True, help="Athlete identifier.")
    parser.add_argument("--batch", type=int, default=500, help="Batch size for upserts.")
    args = parser.parse_args()

    load_dotenv()

    try:
        settings = Settings.from_env()
    except ValueError as exc:
        raise SystemExit(f"Config error: {exc}") from exc

    client = get_supabase_client(settings)

    input_path = Path(args.input)
    print(f"Loading CSV: {input_path}")
    df = load_tp_csv(input_path)
    mvp = build_mvp_dataset(df)

    mvp["athlete_id"] = args.athlete_id
    mvp["workout_day"] = pd.to_datetime(mvp["workout_day"], errors="coerce").dt.date

    records = mvp.where(pd.notnull(mvp), None).to_dict(orient="records")
    total = len(records)
    if total == 0:
        print("No records to upload.")
        return

    print(f"Uploading {total} workouts to Supabase...")
    batches = chunked(records, args.batch)
    for index, batch in enumerate(batches, start=1):
        client.table("tp_workouts").upsert(
            batch,
            on_conflict="athlete_id,workout_day,title,workout_type",
        ).execute()
        print(f"Batch {index}/{len(batches)} uploaded ({len(batch)} records).")

    print("Upload complete.")


if __name__ == "__main__":
    main()
