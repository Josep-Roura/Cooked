#!/usr/bin/env python3
"""
RecipeNLG Full Dataset Import Script (CookedFlow / Supabase)

Imports recipes from RecipeNLG full_dataset.csv into Supabase tables:
- public.recipes
- public.recipe_ingredients
- public.recipe_steps

REQUIRES in DB:
- public.recipes has column: fingerprint (text)
- Unique index on recipes(fingerprint) WHERE fingerprint IS NOT NULL
- NO unique constraint on (user_id, title) (RecipeNLG has many duplicate titles)

Environment variables:
  SUPABASE_URL                 - Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY    - Service role key (bypasses RLS)
  RECIPES_OWNER_USER_ID        - User UUID to assign recipes to
  CSV_PATH                     - Path to full_dataset.csv (default: ./data/full_dataset.csv)
  BATCH_SIZE                   - Rows per batch (default: 2000)
  MAX_ROWS                     - Max rows to import (0 = no limit, default: 0)
  IMPORT_BATCH                 - Label saved in recipes.import_batch (default: recipenlg_full_dataset)
  PURGE_BEFORE_IMPORT          - If "1", deletes ALL recipes+ingredients+steps for this user before import

Usage:
  python scripts/import_recipenlg.py
  CSV_PATH=/path/to/full_dataset.csv python scripts/import_recipenlg.py
"""

import csv
import hashlib
import json
import os
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

from supabase import create_client


def sha1_text(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8", errors="ignore")).hexdigest()


def canonicalize_title(title: str) -> str:
    return " ".join((title or "").strip().lower().split())


def safe_json_loads(value: str, default=None):
    if value is None:
        return default
    v = value.strip() if isinstance(value, str) else str(value).strip()
    if not v:
        return default
    try:
        return json.loads(v)
    except Exception:
        return default


def parse_recipenlg_row(row: Dict[str, str]) -> Optional[Dict[str, Any]]:
    title = (row.get("title") or "").strip()
    if not title:
        return None

    ingredients_list = safe_json_loads(row.get("ingredients", ""), default=[])
    directions_list = safe_json_loads(row.get("directions", ""), default=[])
    ner_list = safe_json_loads(row.get("NER", ""), default=[])

    if not isinstance(ingredients_list, list):
        ingredients_list = []
    if not isinstance(directions_list, list):
        directions_list = []
    if not isinstance(ner_list, list):
        ner_list = []

    link = (row.get("link") or "").strip() or None
    source = (row.get("source") or "RecipeNLG").strip() or "RecipeNLG"
    source_id = (row.get("index") or "").strip()

    canonical_title = canonicalize_title(title)

    fp_payload = {"t": canonical_title, "i": ingredients_list, "d": directions_list}
    fingerprint = sha1_text(json.dumps(fp_payload, ensure_ascii=False, sort_keys=True))

    return {
        "title": title,
        "canonical_title": canonical_title,
        "ingredients": ingredients_list,
        "directions": directions_list,
        "ner": ner_list,
        "link": link,
        "source": source,
        "source_id": source_id,
        "fingerprint": fingerprint,
    }


def connect_supabase():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, key)


def purge_user_recipes(client, user_id: str):
    """
    Deletes ALL recipes and their ingredients/steps for this user.
    Use with caution.
    """
    print("🧨 PURGE_BEFORE_IMPORT=1 -> deleting existing recipes for this user...")

    # Fetch recipe ids for user (in pages)
    recipe_ids: List[str] = []
    page_size = 1000
    offset = 0

    while True:
        resp = (
            client.table("recipes")
            .select("id")
            .eq("user_id", user_id)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            break
        recipe_ids.extend([r["id"] for r in rows])
        offset += page_size

    if not recipe_ids:
        print("✅ No existing recipes found for this user.")
        return

    # Delete in chunks
    chunk = 200
    for i in range(0, len(recipe_ids), chunk):
        ids = recipe_ids[i:i + chunk]
        client.table("recipe_ingredients").delete().in_("recipe_id", ids).execute()
        client.table("recipe_steps").delete().in_("recipe_id", ids).execute()

    # Finally delete recipes
    for i in range(0, len(recipe_ids), chunk):
        ids = recipe_ids[i:i + chunk]
        client.table("recipes").delete().in_("id", ids).execute()

    print(f"✅ Purged recipes={len(recipe_ids):,} (and their ingredients/steps).")


def fetch_recipe_ids_by_fingerprint(client, fingerprints: List[str]) -> Dict[str, str]:
    """
    Returns mapping fingerprint -> recipe_id
    """
    out: Dict[str, str] = {}
    chunk = 200
    for i in range(0, len(fingerprints), chunk):
        fp_chunk = fingerprints[i:i + chunk]
        resp = client.table("recipes").select("id,fingerprint").in_("fingerprint", fp_chunk).execute()
        for row in (resp.data or []):
            fp = row.get("fingerprint")
            rid = row.get("id")
            if fp and rid:
                out[fp] = rid
    return out


def import_batch(
    client,
    user_id: str,
    batch_name: str,
    rows: List[Dict[str, Any]],
    batch_row_start_index: int,
) -> Tuple[int, int, int]:
    recipes_upserted = 0
    ingredients_inserted = 0
    steps_inserted = 0

    # 1) Build recipe records
    recipe_data: List[Dict[str, Any]] = []
    for i, r in enumerate(rows):
        source_id = r.get("source_id") or str(batch_row_start_index + i)
        recipe_data.append({
            "user_id": user_id,
            "title": (r["title"][:500] if r["title"] else "Untitled"),
            "canonical_title": (r["canonical_title"][:500] if r["canonical_title"] else ""),
            "description": None,
            "servings": 1,
            "cook_time_min": None,
            "category": None,
            "tags": [],
            "emoji": None,
            "macros_kcal": 0,
            "macros_protein_g": 0,
            "macros_carbs_g": 0,
            "macros_fat_g": 0,
            "diet_tags": [],
            "meal_tags": [],
            "fingerprint": r["fingerprint"],
            "source": r.get("source") or "RecipeNLG",
            "source_id": source_id,
            "source_url": r.get("link"),
            "import_batch": batch_name,
            "is_public": True,
            "language": "en",
        })

    # 2) Upsert recipes by fingerprint
    try:
        up = client.table("recipes").upsert(
            recipe_data,
            on_conflict="fingerprint"
        ).execute()
        recipes_upserted = len(up.data or [])
    except Exception as e:
        raise RuntimeError(
            f"Upsert failed. Most likely missing UNIQUE index on recipes(fingerprint) "
            f"or still have UNIQUE(user_id,title). Error: {e}"
        )

    # 3) Fetch ids for this batch by fingerprint
    fps = [r["fingerprint"] for r in rows]
    fp_to_id = fetch_recipe_ids_by_fingerprint(client, fps)

    recipe_ids = list(fp_to_id.values())
    if not recipe_ids:
        return recipes_upserted, 0, 0

    # 4) Delete existing ingredients/steps for these recipes (idempotent re-import)
    try:
        chunk = 200
        for i in range(0, len(recipe_ids), chunk):
            ids = recipe_ids[i:i + chunk]
            client.table("recipe_ingredients").delete().in_("recipe_id", ids).execute()
            client.table("recipe_steps").delete().in_("recipe_id", ids).execute()
    except Exception as e:
        print(f"⚠️  Warning: could not clean existing ingredients/steps for batch: {e}")

    # 5) Build ingredients + steps payloads
    ingredients_to_insert: List[Dict[str, Any]] = []
    steps_to_insert: List[Dict[str, Any]] = []

    for r in rows:
        recipe_id = fp_to_id.get(r["fingerprint"])
        if not recipe_id:
            continue

        ingredients_list: List[str] = r.get("ingredients") or []
        directions_list: List[str] = r.get("directions") or []
        ner_list: List[str] = r.get("ner") or []

        for idx, ing_line in enumerate(ingredients_list, start=1):
            ing_line_str = str(ing_line).strip()
            if not ing_line_str:
                continue

            normalized_name = None
            if idx - 1 < len(ner_list):
                nn = str(ner_list[idx - 1]).strip()
                normalized_name = nn[:200] if nn else None

            ingredients_to_insert.append({
                "recipe_id": recipe_id,
                "user_id": user_id,
                "name": ing_line_str[:300],
                "quantity": None,
                "unit": None,
                "category": "other",
                "optional": False,
                "normalized_name": normalized_name,
                "quantity_text": ing_line_str[:500],
                "unit_standard": "other",
                "grams_equivalent": None,
                "sort_order": idx,
                "raw_line": ing_line_str[:2000],
                "parsed_quantity": None,
                "parsed_unit": None,
                "usda_fdc_id": None,
                "match_confidence": None,
                "match_method": None,
            })

        for s_idx, step in enumerate(directions_list, start=1):
            step_text = str(step).strip()
            if not step_text:
                continue
            steps_to_insert.append({
                "recipe_id": recipe_id,
                "user_id": user_id,
                "step_number": s_idx,
                "instruction": step_text[:4000],
                "timer_seconds": None,
            })

    # 6) Insert ingredients + steps
    if ingredients_to_insert:
        chunk = 5000
        for i in range(0, len(ingredients_to_insert), chunk):
            client.table("recipe_ingredients").insert(ingredients_to_insert[i:i + chunk]).execute()
        ingredients_inserted = len(ingredients_to_insert)

    if steps_to_insert:
        chunk = 5000
        for i in range(0, len(steps_to_insert), chunk):
            client.table("recipe_steps").insert(steps_to_insert[i:i + chunk]).execute()
        steps_inserted = len(steps_to_insert)

    return recipes_upserted, ingredients_inserted, steps_inserted


def main():
    user_id = os.environ.get("RECIPES_OWNER_USER_ID")
    csv_path = os.environ.get("CSV_PATH", "data/full_dataset.csv")
    batch_name = os.environ.get("IMPORT_BATCH", "recipenlg_full_dataset")
    batch_size = int(os.environ.get("BATCH_SIZE", "2000"))
    max_rows = int(os.environ.get("MAX_ROWS", "0"))
    purge = os.environ.get("PURGE_BEFORE_IMPORT", "0") == "1"

    if not user_id:
        print("❌ Missing RECIPES_OWNER_USER_ID environment variable")
        sys.exit(1)
    if not os.path.exists(csv_path):
        print(f"❌ CSV file not found: {csv_path}")
        sys.exit(1)

    print("🚀 RecipeNLG Full Dataset Import")
    print(f"   CSV: {csv_path}")
    print(f"   User ID: {user_id}")
    print(f"   Batch name: {batch_name}")
    print(f"   Batch size: {batch_size}")
    if max_rows:
        print(f"   Max rows: {max_rows}")
    print(f"   PURGE_BEFORE_IMPORT: {'YES' if purge else 'NO'}\n")

    client = connect_supabase()
    print("✅ Connected to Supabase\n")

    if purge:
        purge_user_recipes(client, user_id)

    total_recipes = 0
    total_ings = 0
    total_steps = 0
    processed = 0
    start_time = time.time()

    with open(csv_path, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            print("❌ CSV file is empty or invalid")
            sys.exit(1)

        print(f"✅ CSV columns: {', '.join(reader.fieldnames)}\n")

        buffer: List[Dict[str, Any]] = []
        batch_num = 0

        for row in reader:
            parsed = parse_recipenlg_row(row)
            if not parsed:
                continue

            buffer.append(parsed)
            processed += 1

            if max_rows and processed >= max_rows:
                break

            if len(buffer) >= batch_size:
                batch_num += 1
                print(f"📤 Importing batch {batch_num}...", end=" ", flush=True)

                r, i, s = import_batch(client, user_id, batch_name, buffer, processed - len(buffer))
                total_recipes += r
                total_ings += i
                total_steps += s

                elapsed = time.time() - start_time
                rate = processed / elapsed if elapsed > 0 else 0
                print(
                    f"✅ | rows={processed:,} recipes={total_recipes:,} "
                    f"ingredients={total_ings:,} steps={total_steps:,} | {rate:,.1f} rows/s"
                )

                buffer = []

        if buffer:
            batch_num += 1
            print(f"📤 Importing final batch {batch_num}...", end=" ", flush=True)

            r, i, s = import_batch(client, user_id, batch_name, buffer, processed - len(buffer))
            total_recipes += r
            total_ings += i
            total_steps += s

            elapsed = time.time() - start_time
            rate = processed / elapsed if elapsed > 0 else 0
            print(
                f"✅ | rows={processed:,} recipes={total_recipes:,} "
                f"ingredients={total_ings:,} steps={total_steps:,} | {rate:,.1f} rows/s"
            )

    elapsed = time.time() - start_time
    print("\n" + "=" * 70)
    print("✅ IMPORT COMPLETE!")
    print("=" * 70)
    print(f"⏱️  Elapsed: {elapsed:,.1f} seconds ({elapsed / 60:,.1f} minutes)")
    print(f"📊 Results:")
    print(f"   Processed rows: {processed:,}")
    print(f"   Recipes upserted: {total_recipes:,}")
    print(f"   Ingredients inserted: {total_ings:,}")
    print(f"   Steps inserted: {total_steps:,}")
    if elapsed > 0:
        print(f"   Average rate: {processed / elapsed:,.1f} rows/sec")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n❌ Import interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Import failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
