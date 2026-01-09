import argparse
from pathlib import Path

import pandas as pd

from coocked_api.services.day_classifier import classify_day
from coocked_api.services.nutrition_engine import nutrition_targets


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="workouts_mvp.csv")
    parser.add_argument("--weight", type=float, required=True, help="Athlete weight in kg")
    parser.add_argument("--out", default="nutrition_plan_by_day.csv")
    args = parser.parse_args()

    df = pd.read_csv(args.input)
    out_rows = []

    for _, row in df.iterrows():
        day_type = classify_day(row.get("planned_hours"))
        targets = nutrition_targets(
            weight_kg=args.weight,
            day_type=day_type,
            planned_hours=row.get("planned_hours"),
        )

        out_rows.append({
            "date": row["workout_day"],
            "day_type": day_type,
            **targets,
        })

    out_df = pd.DataFrame(out_rows)
    out_df.to_csv(args.out, index=False)
    print(f"Nutrition plan saved to {args.out}")


if __name__ == "__main__":
    main()
