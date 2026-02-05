#!/usr/bin/env python3
"""
RecipeNLG Full Dataset Import v2 - Simplified & Robust

Imports recipes from RecipeNLG full_dataset.csv into Cooked database.
Handles duplicate recipes gracefully.

Environment variables:
  SUPABASE_URL                  - Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY     - Service role key (direct DB access)
  RECIPES_OWNER_USER_ID         - User UUID to assign recipes to
  CSV_PATH                      - Path to full_dataset.csv (default: data/full_dataset.csv)
  BATCH_SIZE                    - Batch size (default: 2000)
  MAX_ROWS                      - Max rows to import (0=all, default: 0)
  PURGE_BEFORE_IMPORT           - Delete existing recipes first (0 or 1, default: 0)

Usage:
  export SUPABASE_URL="https://..."
  export SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
  export RECIPES_OWNER_USER_ID="uuid"
  export CSV_PATH="data/full_dataset.csv"
  export BATCH_SIZE=2000
  export MAX_ROWS=50000
  export PURGE_BEFORE_IMPORT=1
  python3 scripts/import_recipenlg_v2.py
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
    print("❌ Missing supabase library. Install with:")
    print("   pip install supabase")
    sys.exit(1)


def sha1_text(s: str) -> str:
    """Generate SHA1 fingerprint."""
    return hashlib.sha1(s.encode("utf-8", errors="ignore")).hexdigest()


def canonicalize_title(title: str) -> str:
    """Normalize title."""
    return " ".join((title or "").strip().lower().split())


def safe_json_loads(value: str, default=None):
    """Safely parse JSON."""
    if not value:
        return default
    try:
        return json.loads(value)
    except Exception:
        return default


def parse_recipenlg_row(row: Dict[str, str]) -> Optional[Dict[str, Any]]:
    """Parse a RecipeNLG CSV row."""
    title = (row.get("title") or "").strip()
    if not title:
        return None

    ingredients_list = safe_json_loads(row.get("ingredients", ""), default=[])
    directions_list = safe_json_loads(row.get("directions", ""), default=[])

    if not isinstance(ingredients_list, list):
        ingredients_list = []
    if not isinstance(directions_list, list):
        directions_list = []

    link = (row.get("link") or "").strip() or None
    source = (row.get("source") or "RecipeNLG").strip() or "RecipeNLG"

    canonical_title = canonicalize_title(title)

    # Fingerprint: deterministic hash
    fp_payload = {
        "t": canonical_title,
        "i": ingredients_list,
        "d": directions_list,
    }
    fingerprint = sha1_text(json.dumps(fp_payload, ensure_ascii=False, sort_keys=True))

    return {
        "title": title,
        "canonical_title": canonical_title,
        "ingredients": ingredients_list,
        "directions": directions_list,
        "link": link,
        "source": source,
        "fingerprint": fingerprint,
    }


def connect_supabase():
    """Connect to Supabase."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

    return create_client(url, key)


def purge_user_recipes(client, user_id: str) -> None:
    """Delete all existing recipes for user."""
    print("🗑️  Purging existing recipes for user...")
    try:
        # Delete in order: steps, ingredients, then recipes
        client.table("recipe_steps").delete().eq("user_id", user_id).execute()
        print("   ✅ Deleted steps")

        client.table("recipe_ingredients").delete().eq("user_id", user_id).execute()
        print("   ✅ Deleted ingredients")

        client.table("recipes").delete().eq("user_id", user_id).execute()
        print("   ✅ Deleted recipes")
    except Exception as e:
        print(f"   ⚠️  Purge warning: {e}")


def import_batch(
    client,
    user_id: str,
    batch_name: str,
    rows: List[Dict[str, Any]],
) -> Tuple[int, int, int]:
    """
    Import a batch of recipes.
    
    Returns (recipes_inserted, ingredients_inserted, steps_inserted)
    """
    recipes_inserted = 0
    ingredients_inserted = 0
    steps_inserted = 0

    # 1) Try to insert recipes
    recipe_records = []
    recipe_fp_to_id = {}

    for r in rows:
        # Prepare recipe record
        record = {
            "user_id": user_id,
            "title": r["title"][:500] if r["title"] else "Untitled",
            "canonical_title": r["canonical_title"][:500] if r["canonical_title"] else "",
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
            "canonical_title": r["canonical_title"],
            "fingerprint": r["fingerprint"],
            "source": r["source"],
            "source_id": None,
            "source_url": r.get("link"),
            "import_batch": batch_name,
            "is_public": True,
            "language": "en",
        }
        recipe_records.append(record)

    # Insert recipes (handle duplicates by inserting one-by-one as fallback)
    if recipe_records:
        try:
            response = client.table("recipes").insert(recipe_records).execute()
            if response.data:
                recipes_inserted = len(response.data)
                # Build map of fingerprints to IDs
                for recipe in response.data:
                    fp = recipe.get("fingerprint")
                    if fp:
                        recipe_fp_to_id[fp] = recipe["id"]
        except Exception as e:
            # Handle duplicate title errors - insert one-by-one instead
            error_msg = str(e)
            if "duplicate key" in error_msg or "unique" in error_msg.lower():
                # Insert recipes individually, skipping duplicates
                for record in recipe_records:
                    try:
                        response = client.table("recipes").insert([record]).execute()
                        if response.data:
                            recipe_id = response.data[0]["id"]
                            recipe_fp_to_id[record["fingerprint"]] = recipe_id
                            recipes_inserted += 1
                    except Exception as inner_e:
                        # Try to find existing recipe by title
                        try:
                            existing = client.table("recipes").select("id").eq(
                                "user_id", user_id
                            ).eq("title", record["title"]).limit(1).execute()

                            if existing.data:
                                recipe_fp_to_id[record["fingerprint"]] = existing.data[0]["id"]
                                recipes_inserted += 1
                        except Exception:
                            pass  # Skip on error
            else:
                print(f"⚠️  Insert error: {e}")
                return 0, 0, 0

    # 2) Get recipe IDs and insert ingredients/steps
    recipe_ids = list(recipe_fp_to_id.values())

    if not recipe_ids:
        return recipes_inserted, 0, 0

    # Delete old ingredients/steps
    try:
        for recipe_id in recipe_ids:
            client.table("recipe_ingredients").delete().eq(
                "recipe_id", recipe_id
            ).execute()
            client.table("recipe_steps").delete().eq("recipe_id", recipe_id).execute()
    except Exception:
        pass  # Ignore cleanup errors

    # 3) Insert ingredients and steps
    ingredients_to_insert = []
    steps_to_insert = []

    for i, r in enumerate(rows):
        recipe_id = recipe_fp_to_id.get(r["fingerprint"])
        if not recipe_id:
            continue

        # Insert ingredients
        for idx, ing_line in enumerate(r.get("ingredients") or [], start=1):
            ing_text = str(ing_line).strip()
            if not ing_text:
                continue

            ingredients_to_insert.append({
                "recipe_id": recipe_id,
                "user_id": user_id,
                "name": ing_text[:300],
                "quantity": None,
                "unit": None,
                "category": "other",
                "optional": False,
                "normalized_name": None,
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

        # Insert steps
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

    # Batch insert ingredients
    if ingredients_to_insert:
        try:
            client.table("recipe_ingredients").insert(ingredients_to_insert).execute()
            ingredients_inserted = len(ingredients_to_insert)
        except Exception as e:
            print(f"⚠️  Ingredient insert error: {e}")

    # Batch insert steps
    if steps_to_insert:
        try:
            client.table("recipe_steps").insert(steps_to_insert).execute()
            steps_inserted = len(steps_to_insert)
        except Exception as e:
            print(f"⚠️  Steps insert error: {e}")

    return recipes_inserted, ingredients_inserted, steps_inserted


def main():
    """Main import."""
    user_id = os.environ.get("RECIPES_OWNER_USER_ID")
    csv_path = os.environ.get("CSV_PATH", "data/full_dataset.csv")
    batch_name = os.environ.get("IMPORT_BATCH", "recipenlg_full_dataset")
    batch_size = int(os.environ.get("BATCH_SIZE", "2000"))
    max_rows = int(os.environ.get("MAX_ROWS", "0"))
    purge_before = int(os.environ.get("PURGE_BEFORE_IMPORT", "0"))

    # Validation
    if not user_id:
        print("❌ Missing RECIPES_OWNER_USER_ID")
        sys.exit(1)

    if not os.path.exists(csv_path):
        print(f"❌ CSV file not found: {csv_path}")
        sys.exit(1)

    print("🚀 RecipeNLG Full Dataset Import v2")
    print(f"   CSV: {csv_path}")
    print(f"   User ID: {user_id}")
    print(f"   Batch size: {batch_size}")
    if max_rows:
        print(f"   Max rows: {max_rows}")
    print(f"   Purge before: {'YES' if purge_before else 'NO'}")
    print()

    # Connect
    try:
        client = connect_supabase()
        print("✅ Connected to Supabase\n")
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        sys.exit(1)

    # Purge if requested
    if purge_before:
        purge_user_recipes(client, user_id)
        print()

    # Import
    total_recipes = 0
    total_ings = 0
    total_steps = 0
    processed = 0
    start_time = time.time()

    try:
        with open(csv_path, "r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)

            if not reader.fieldnames:
                print("❌ CSV is empty")
                sys.exit(1)

            print(f"✅ CSV columns: {', '.join(reader.fieldnames)}\n")

            buffer = []

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

                    try:
                        r, i, s = import_batch(
                            client,
                            user_id,
                            batch_name,
                            buffer,
                        )
                        total_recipes += r
                        total_ings += i
                        total_steps += s

                        elapsed = time.time() - start_time
                        rate = processed / elapsed if elapsed > 0 else 0
                        print(
                            f"✅ | recipes={total_recipes:,} "
                            f"ings={total_ings:,} steps={total_steps:,} | {rate:.1f} rows/s"
                        )
                    except Exception as e:
                        print(f"❌ {e}")
                        raise

                    buffer = []

            # Final batch
            if buffer:
                print(f"📤 Final batch...", end=" ", flush=True)
                try:
                    r, i, s = import_batch(client, user_id, batch_name, buffer)
                    total_recipes += r
                    total_ings += i
                    total_steps += s

                    elapsed = time.time() - start_time
                    rate = processed / elapsed if elapsed > 0 else 0
                    print(
                        f"✅ | recipes={total_recipes:,} "
                        f"ings={total_ings:,} steps={total_steps:,} | {rate:.1f} rows/s"
                    )
                except Exception as e:
                    print(f"❌ {e}")
                    raise

        # Summary
        elapsed = time.time() - start_time
        print("\n" + "=" * 70)
        print("✅ IMPORT COMPLETE!")
        print("=" * 70)
        print(f"⏱️  Time: {elapsed / 60:.1f} minutes ({elapsed:.0f} seconds)")
        print(f"📊 Results:")
        print(f"   Processed rows: {processed:,}")
        print(f"   Recipes inserted: {total_recipes:,}")
        print(f"   Ingredients inserted: {total_ings:,}")
        print(f"   Steps inserted: {total_steps:,}")
        if elapsed > 0:
            print(f"   Rate: {processed / elapsed:.1f} rows/sec")
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
