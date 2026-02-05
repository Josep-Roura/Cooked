#!/usr/bin/env python3
"""
RecipeNLG Full Dataset Import v3 - Reliable ingredients/steps + title de-dup

Fixes:
- Inserts ingredients/steps in CHUNKS to avoid PostgREST payload limits.
- Handles RecipeNLG CSV with leading index column (header is "" then title,...)
- Uses NER to fill normalized_name when available.
- Avoids unique constraint (user_id, title) by making titles deterministic-unique.

Env:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  RECIPES_OWNER_USER_ID
  CSV_PATH (default: data/full_dataset.csv)
  BATCH_SIZE (default: 1000)
  MAX_ROWS (default: 0 = all)
  PURGE_BEFORE_IMPORT (default: 0)
  ING_CHUNK_SIZE (default: 1000)
  STEPS_CHUNK_SIZE (default: 1000)

Run:
  python3 scripts/import_recipenlg_v3.py
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


def safe_json_loads(value: Any, default=None):
    if value is None:
        return default
    if not isinstance(value, str):
        value = str(value)
    v = value.strip()
    if not v:
        return default
    try:
        return json.loads(v)
    except Exception:
        return default


def parse_recipenlg_row(row: Dict[str, str]) -> Optional[Dict[str, Any]]:
    """
    Works with CSV like:
    ,title,ingredients,directions,link,source,NER
    0,No-Bake Nut Cookies,"[...]","[...]",www...,Gathered,"[...]"
    """
    title = (row.get("title") or "").strip()
    if not title:
        return None

    ingredients_list = safe_json_loads(row.get("ingredients"), default=[])
    directions_list = safe_json_loads(row.get("directions"), default=[])
    ner_list = safe_json_loads(row.get("NER"), default=[])

    if not isinstance(ingredients_list, list):
        ingredients_list = []
    if not isinstance(directions_list, list):
        directions_list = []
    if not isinstance(ner_list, list):
        ner_list = []

    link = (row.get("link") or "").strip() or None
    source = (row.get("source") or "RecipeNLG").strip() or "RecipeNLG"

    # RecipeNLG often has a leading index column with empty header ""
    source_id = (row.get("") or row.get("index") or row.get("id") or "").strip() or None

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
        "source_id": source_id,   # may be None
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
    try:
        client.table("recipe_steps").delete().eq("user_id", user_id).execute()
        print("   ✅ Deleted steps")
        client.table("recipe_ingredients").delete().eq("user_id", user_id).execute()
        print("   ✅ Deleted ingredients")
        client.table("recipes").delete().eq("user_id", user_id).execute()
        print("   ✅ Deleted recipes")
    except Exception as e:
        print(f"   ⚠️  Purge warning: {e}")


def chunked(lst: List[Dict[str, Any]], size: int):
    for i in range(0, len(lst), size):
        yield lst[i:i + size]


def make_unique_title(base_title: str, source: str, source_id: Optional[str], fingerprint: str) -> str:
    """
    DB has unique (user_id, title). RecipeNLG has duplicate titles.
    We make the title deterministic-unique without losing meaning.
    """
    t = (base_title or "Untitled").strip()
    t = t[:450]  # leave room for suffix

    sid = source_id or fingerprint[:8]
    suffix = f" [{source}#{sid}]"
    final = (t + suffix)[:500]
    return final


def fetch_recipe_ids_by_fingerprint(client, fps: List[str]) -> Dict[str, str]:
    fp_to_id: Dict[str, str] = {}
    if not fps:
        return fp_to_id

    # PostgREST URL length limit: do in chunks
    for fp_chunk in [fps[i:i + 200] for i in range(0, len(fps), 200)]:
        resp = client.table("recipes").select("id,fingerprint").in_("fingerprint", fp_chunk).execute()
        for r in (resp.data or []):
            if r.get("fingerprint") and r.get("id"):
                fp_to_id[r["fingerprint"]] = r["id"]
    return fp_to_id


def import_batch(
    client,
    user_id: str,
    batch_name: str,
    rows: List[Dict[str, Any]],
    ing_chunk_size: int,
    steps_chunk_size: int,
) -> Tuple[int, int, int]:
    """
    Returns (recipes_ensured, ingredients_inserted, steps_inserted)
    """
    if not rows:
        return 0, 0, 0

    # De-dupe inside batch by fingerprint to reduce work
    uniq_by_fp: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        uniq_by_fp[r["fingerprint"]] = r
    uniq_rows = list(uniq_by_fp.values())

    # 1) Insert recipes (ignore duplicates by title by making title unique)
    recipe_records: List[Dict[str, Any]] = []
    for r in uniq_rows:
        recipe_records.append({
            "user_id": user_id,
            "title": make_unique_title(r["title"], r["source"], r.get("source_id"), r["fingerprint"]),
            "canonical_title": (f'{r["canonical_title"]} {r["fingerprint"][:8]}'[:500] if r.get("canonical_title") else r["fingerprint"][:8]),            "servings": 1,
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
            "source": r["source"],
            "source_id": (r.get("source_id") or None),
            "source_url": r.get("link"),
            "import_batch": batch_name,
            "is_public": True,
            "language": "en",
        })

    # Insert in manageable chunks
    recipes_attempted = 0
    for rec_chunk in chunked(recipe_records, 500):
        try:
            client.table("recipes").insert(rec_chunk).execute()
        except Exception as e:
            # Even with unique title, some other constraint could fail.
            # We don't want to stop all import; print and continue.
            print(f"⚠️  Recipe insert chunk warning: {e}")
        recipes_attempted += len(rec_chunk)

    # 2) Fetch IDs for all fingerprints in this batch
    fps = [r["fingerprint"] for r in uniq_rows]
    fp_to_id = fetch_recipe_ids_by_fingerprint(client, fps)
    recipes_ensured = len(fp_to_id)

    if not fp_to_id:
        return recipes_ensured, 0, 0

    # 3) Build ingredients / steps payloads
    ingredients_to_insert: List[Dict[str, Any]] = []
    steps_to_insert: List[Dict[str, Any]] = []

    for r in uniq_rows:
        recipe_id = fp_to_id.get(r["fingerprint"])
        if not recipe_id:
            continue

        ner_list: List[str] = r.get("ner") or []

        # Ingredients
        for idx, ing_line in enumerate(r.get("ingredients") or [], start=1):
            ing_text = str(ing_line).strip()
            if not ing_text:
                continue

            normalized_name = None
            if idx - 1 < len(ner_list):
                nn = str(ner_list[idx - 1]).strip()
                normalized_name = nn[:200] if nn else None

            ingredients_to_insert.append({
                "recipe_id": recipe_id,
                "user_id": user_id,
                "name": ing_text[:300],
                "quantity": None,
                "unit": None,
                "category": "other",
                "optional": False,
                "normalized_name": normalized_name,
                "quantity_text": ing_text[:500],
                "unit_standard": "other",
                "grams_equivalent": None,
                "sort_order": idx,
                "raw_line": ing_text[:2000],
                "parsed_quantity": None,
                "parsed_unit": None,
                "usda_fdc_id": None,
                "match_confidence": None,
                "match_method": None,
            })

        # Steps
        for s_idx, step in enumerate(r.get("directions") or [], start=1):
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

    # 4) Insert ingredients / steps in chunks (CRITICAL FIX)
    ingredients_inserted = 0
    if ingredients_to_insert:
        for ing_chunk in chunked(ingredients_to_insert, ing_chunk_size):
            try:
                client.table("recipe_ingredients").insert(ing_chunk).execute()
                ingredients_inserted += len(ing_chunk)
            except Exception as e:
                print(f"⚠️  Ingredient insert chunk failed ({len(ing_chunk)} rows): {e}")

    steps_inserted = 0
    if steps_to_insert:
        for st_chunk in chunked(steps_to_insert, steps_chunk_size):
            try:
                client.table("recipe_steps").insert(st_chunk).execute()
                steps_inserted += len(st_chunk)
            except Exception as e:
                print(f"⚠️  Steps insert chunk failed ({len(st_chunk)} rows): {e}")

    return recipes_ensured, ingredients_inserted, steps_inserted


def main():
    user_id = os.environ.get("RECIPES_OWNER_USER_ID")
    csv_path = os.environ.get("CSV_PATH", "data/full_dataset.csv")
    batch_name = os.environ.get("IMPORT_BATCH", "recipenlg_full_dataset")
    batch_size = int(os.environ.get("BATCH_SIZE", "1000"))
    max_rows = int(os.environ.get("MAX_ROWS", "0"))
    purge_before = int(os.environ.get("PURGE_BEFORE_IMPORT", "0"))
    ing_chunk_size = int(os.environ.get("ING_CHUNK_SIZE", "1000"))
    steps_chunk_size = int(os.environ.get("STEPS_CHUNK_SIZE", "1000"))

    if not user_id:
        print("❌ Missing RECIPES_OWNER_USER_ID")
        sys.exit(1)
    if not os.path.exists(csv_path):
        print(f"❌ CSV file not found: {csv_path}")
        sys.exit(1)

    print("🚀 RecipeNLG Full Dataset Import v3")
    print(f"   CSV: {csv_path}")
    print(f"   User ID: {user_id}")
    print(f"   Batch size: {batch_size}")
    print(f"   ING chunk: {ing_chunk_size}")
    print(f"   STEPS chunk: {steps_chunk_size}")
    if max_rows:
        print(f"   Max rows: {max_rows}")
    print(f"   Purge before: {'YES' if purge_before else 'NO'}")
    print()

    try:
        client = connect_supabase()
        print("✅ Connected to Supabase\n")
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        sys.exit(1)

    if purge_before:
        purge_user_recipes(client, user_id)
        print()

    total_recipes = 0
    total_ings = 0
    total_steps = 0
    processed = 0
    start_time = time.time()

    try:
        with open(csv_path, "r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            if not reader.fieldnames:
                print("❌ CSV is empty/invalid")
                sys.exit(1)

            print(f"✅ CSV columns: {', '.join(reader.fieldnames)}\n")

            buffer: List[Dict[str, Any]] = []

            for row in reader:
                parsed = parse_recipenlg_row(row)
                if not parsed:
                    continue

                buffer.append(parsed)
                processed += 1

                if max_rows and processed >= max_rows:
                    break

                if len(buffer) >= batch_size:
                    batch_num = (processed // batch_size)
                    print(f"📤 Batch {batch_num}...", end=" ", flush=True)

                    r, i, s = import_batch(
                        client, user_id, batch_name, buffer, ing_chunk_size, steps_chunk_size
                    )
                    total_recipes += r
                    total_ings += i
                    total_steps += s

                    elapsed = time.time() - start_time
                    rate = processed / elapsed if elapsed > 0 else 0
                    print(f"✅ | recipes={total_recipes:,} ings={total_ings:,} steps={total_steps:,} | {rate:.1f} rows/s")

                    buffer = []

            if buffer:
                print("📤 Final batch...", end=" ", flush=True)
                r, i, s = import_batch(
                    client, user_id, batch_name, buffer, ing_chunk_size, steps_chunk_size
                )
                total_recipes += r
                total_ings += i
                total_steps += s

                elapsed = time.time() - start_time
                rate = processed / elapsed if elapsed > 0 else 0
                print(f"✅ | recipes={total_recipes:,} ings={total_ings:,} steps={total_steps:,} | {rate:.1f} rows/s")

        elapsed = time.time() - start_time
        print("\n" + "=" * 70)
        print("✅ IMPORT COMPLETE!")
        print("=" * 70)
        print(f"⏱️  Time: {elapsed / 60:.1f} minutes ({elapsed:.0f} seconds)")
        print(f"📊 Processed rows: {processed:,}")
        print(f"📌 Recipes ensured (by fingerprint): {total_recipes:,}")
        print(f"🥕 Ingredients inserted: {total_ings:,}")
        print(f"👣 Steps inserted: {total_steps:,}")
        if elapsed > 0:
            print(f"⚡ Rate: {processed / elapsed:.1f} rows/sec")
        print()

    except KeyboardInterrupt:
        print("\n❌ Interrupted")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
