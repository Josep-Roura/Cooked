#!/usr/bin/env python3
"""
RecipeNLG Import v4 (CSV format: leading index column, JSON strings in ingredients/directions/NER)

CSV sample:
,title,ingredients,directions,link,source,NER
0,No-Bake Nut Cookies,"[""1 c. ... ""]","[""Step...""]",www...,Gathered,"[""brown sugar""]"

Env:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  RECIPES_OWNER_USER_ID
  CSV_PATH (default: data/full_dataset.csv)
  BATCH_SIZE (default: 2000)
  MAX_ROWS (default: 0)
  PURGE_BEFORE_IMPORT (default: 0)
  INSERT_CHUNK (default: 2000)

Notes:
- Uses fingerprint (hash of canonical title + ingredients + directions) as dedupe key.
- Upserts recipes by fingerprint, then refetches ids by fingerprint for reliable mapping.
- Inserts ingredients/steps in chunks to avoid payload limits.
"""

import csv
import hashlib
import json
import os
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

try:
    from supabase import create_client
except ImportError:
    print("❌ Missing supabase library. Install with: pip install supabase")
    sys.exit(1)


def sha1_text(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8", errors="ignore")).hexdigest()


def canonicalize_title(title: str) -> str:
    return " ".join((title or "").strip().lower().split())


def safe_json_list(value: Any) -> List[str]:
    """
    RecipeNLG here is proper JSON (e.g. ["a","b"]) inside CSV quoting.
    Returns list[str]. Empty on failure.
    """
    if value is None:
        return []
    s = str(value).strip()
    if not s:
        return []
    try:
        parsed = json.loads(s)
        if not isinstance(parsed, list):
            return []
        return [str(x).strip() for x in parsed if str(x).strip()]
    except Exception:
        return []


def get_row_index(row: Dict[str, str]) -> Optional[str]:
    """
    Your CSV has a leading unnamed column: header is '' or sometimes 'Unnamed: 0'
    """
    for key in ("", "Unnamed: 0", "\ufeff", "\ufeffUnnamed: 0"):
        if key in row and str(row.get(key, "")).strip() != "":
            return str(row[key]).strip()
    return None


def parse_row(row: Dict[str, str]) -> Optional[Dict[str, Any]]:
    title = (row.get("title") or "").strip()
    if not title:
        return None

    ingredients = safe_json_list(row.get("ingredients"))
    directions = safe_json_list(row.get("directions"))
    ner = safe_json_list(row.get("NER"))

    link = (row.get("link") or "").strip() or None
    source = (row.get("source") or "RecipeNLG").strip() or "RecipeNLG"
    source_id = get_row_index(row)

    canonical = canonicalize_title(title)
    fp_payload = {"t": canonical, "i": ingredients, "d": directions}
    fingerprint = sha1_text(json.dumps(fp_payload, ensure_ascii=False, sort_keys=True))

    return {
        "title": title,
        "canonical_title": canonical,
        "ingredients": ingredients,
        "directions": directions,
        "ner": ner,
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


def purge_user_recipes(client, user_id: str) -> None:
    print("🗑️  Purging existing recipes for user...")
    client.table("recipe_steps").delete().eq("user_id", user_id).execute()
    client.table("recipe_ingredients").delete().eq("user_id", user_id).execute()
    client.table("recipes").delete().eq("user_id", user_id).execute()
    print("   ✅ Purged steps, ingredients, recipes")


def chunks(lst: List[Any], n: int):
    for i in range(0, len(lst), n):
        yield lst[i:i + n]


def import_batch(
    client,
    user_id: str,
    batch_name: str,
    rows: List[Dict[str, Any]],
    insert_chunk: int,
) -> Tuple[int, int, int]:
    """
    Returns (recipes_upserted, ingredients_inserted, steps_inserted)
    """
    if not rows:
        return 0, 0, 0

    # 1) UPSERT recipes by fingerprint
    recipe_records = []
    fps = []
    for r in rows:
        fps.append(r["fingerprint"])
        recipe_records.append({
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
            "source_id": r.get("source_id"),
            "source_url": r.get("link"),
            "import_batch": batch_name,
            "is_public": True,
            "language": "en",
        })

    # Try batch insert first
    recipes_upserted = 0
    try:
        resp = client.table("recipes").insert(recipe_records).execute()
        recipes_upserted = len(resp.data) if resp.data else 0
    except Exception as e:
        # If batch insert fails (duplicate titles), insert one-by-one
        error_msg = str(e).lower()
        if "duplicate" in error_msg or "unique" in error_msg:
            for rec in recipe_records:
                try:
                    resp = client.table("recipes").insert([rec]).execute()
                    if resp.data:
                        recipes_upserted += 1
                except Exception:
                    # Recipe already exists (duplicate title), skip it
                    pass
        else:
            raise RuntimeError(f"Recipe insert failed: {e}")

    # 2) Refetch IDs by fingerprint (reliable mapping)
    fp_to_id: Dict[str, str] = {}
    for fp_chunk in chunks(fps, 200):
        res = client.table("recipes").select("id,fingerprint").in_("fingerprint", fp_chunk).execute()
        for rr in (res.data or []):
            if rr.get("fingerprint") and rr.get("id"):
                fp_to_id[rr["fingerprint"]] = rr["id"]

    # 3) Build ingredient and step rows
    ingredients_rows: List[Dict[str, Any]] = []
    steps_rows: List[Dict[str, Any]] = []

    for r in rows:
        recipe_id = fp_to_id.get(r["fingerprint"])
        if not recipe_id:
            continue

        # ingredients (raw lines)
        for idx, ing in enumerate(r.get("ingredients") or [], start=1):
            ingredients_rows.append({
                "recipe_id": recipe_id,
                "user_id": user_id,
                "name": str(ing)[:300],
                "quantity": None,
                "unit": None,
                "category": "other",
                "optional": False,
                "normalized_name": (r["ner"][idx - 1][:200] if (r.get("ner") and idx - 1 < len(r["ner"])) else None),
                "quantity_text": str(ing)[:500],
                "unit_standard": "other",
                "grams_equivalent": None,
                "sort_order": idx,
                "raw_line": str(ing)[:2000],
                "parsed_quantity": None,
                "parsed_unit": None,
                "usda_fdc_id": None,
                "match_confidence": None,
                "match_method": None,
            })

        # steps
        for s_idx, step in enumerate(r.get("directions") or [], start=1):
            steps_rows.append({
                "recipe_id": recipe_id,
                "user_id": user_id,
                "step_number": s_idx,
                "instruction": str(step)[:4000],
                "timer_seconds": None,
            })

    # 4) Insert ingredients and steps in chunks
    ingredients_inserted = 0
    steps_inserted = 0

    if ingredients_rows:
        for ch in chunks(ingredients_rows, insert_chunk):
            client.table("recipe_ingredients").insert(ch).execute()
        ingredients_inserted = len(ingredients_rows)

    if steps_rows:
        for ch in chunks(steps_rows, insert_chunk):
            client.table("recipe_steps").insert(ch).execute()
        steps_inserted = len(steps_rows)

    return recipes_upserted, ingredients_inserted, steps_inserted


def main():
    user_id = os.environ.get("RECIPES_OWNER_USER_ID")
    csv_path = os.environ.get("CSV_PATH", "data/full_dataset.csv")
    batch_name = os.environ.get("IMPORT_BATCH", "recipenlg_full_dataset")
    batch_size = int(os.environ.get("BATCH_SIZE", "2000"))
    max_rows = int(os.environ.get("MAX_ROWS", "0"))
    purge_before = int(os.environ.get("PURGE_BEFORE_IMPORT", "0"))
    insert_chunk = int(os.environ.get("INSERT_CHUNK", "2000"))

    if not user_id:
        print("❌ Missing RECIPES_OWNER_USER_ID")
        sys.exit(1)
    if not os.path.exists(csv_path):
        print(f"❌ CSV file not found: {csv_path}")
        sys.exit(1)

    client = connect_supabase()

    print("🚀 RecipeNLG Import v4")
    print(f"   CSV: {csv_path}")
    print(f"   User ID: {user_id}")
    print(f"   Batch size: {batch_size}")
    print(f"   Insert chunk: {insert_chunk}")
    print(f"   Purge before: {'YES' if purge_before else 'NO'}")
    print()

    if purge_before:
        purge_user_recipes(client, user_id)
        print()

    total_recipes = total_ings = total_steps = 0
    processed = 0
    parsed_with_ings = 0
    start = time.time()

    with open(csv_path, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            print("❌ CSV has no headers")
            sys.exit(1)

        print(f"✅ Headers: {reader.fieldnames}\n")

        buf: List[Dict[str, Any]] = []
        batch_num = 0

        for row in reader:
            parsed = parse_row(row)
            if not parsed:
                continue
            if parsed["ingredients"]:
                parsed_with_ings += 1

            buf.append(parsed)
            processed += 1

            if max_rows and processed >= max_rows:
                break

            if len(buf) >= batch_size:
                batch_num += 1
                print(f"📤 Batch {batch_num}...", end=" ", flush=True)
                r, i, s = import_batch(client, user_id, batch_name, buf, insert_chunk)
                total_recipes += r
                total_ings += i
                total_steps += s
                elapsed = time.time() - start
                print(f"✅ recipes={total_recipes:,} ings={total_ings:,} steps={total_steps:,} | {processed/elapsed:.1f} rows/s")
                buf = []

        if buf:
            batch_num += 1
            print(f"📤 Final batch {batch_num}...", end=" ", flush=True)
            r, i, s = import_batch(client, user_id, batch_name, buf, insert_chunk)
            total_recipes += r
            total_ings += i
            total_steps += s
            elapsed = time.time() - start
            print(f"✅ recipes={total_recipes:,} ings={total_ings:,} steps={total_steps:,} | {processed/elapsed:.1f} rows/s")

    elapsed = time.time() - start
    print("\n" + "=" * 70)
    print("✅ IMPORT COMPLETE")
    print("=" * 70)
    print(f"Processed rows: {processed:,}")
    print(f"Rows with ingredients parsed: {parsed_with_ings:,}")
    print(f"Recipes upserted: {total_recipes:,}")
    print(f"Ingredients inserted: {total_ings:,}")
    print(f"Steps inserted: {total_steps:,}")
    print(f"Time: {elapsed/60:.1f} min")
    print("=" * 70)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n❌ Interrupted")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
