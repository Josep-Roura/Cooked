#!/usr/bin/env python3
"""
RecipeNLG Full Dataset Import Script

Imports recipes from RecipeNLG full_dataset.csv into the Cooked Supabase database.

Environment variables:
  SUPABASE_URL          - Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY - Service role key (for direct DB access)
  RECIPES_OWNER_USER_ID - User UUID to assign recipes to
  CSV_PATH              - Path to full_dataset.csv (default: ./data/full_dataset.csv)
  BATCH_SIZE            - Rows per batch (default: 2000)
  MAX_ROWS              - Max rows to import (0 = no limit, default: 0)

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
    """Generate SHA1 fingerprint of text."""
    return hashlib.sha1(s.encode("utf-8", errors="ignore")).hexdigest()


def canonicalize_title(title: str) -> str:
    """Normalize title to canonical form."""
    return " ".join((title or "").strip().lower().split())


def safe_json_loads(value: str, default=None):
    """Safely load JSON, returning default on failure."""
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
    """
    Parse a row from RecipeNLG full_dataset.csv.
    
    Expected columns:
      - title: Recipe title
      - ingredients: JSON list of ingredient strings
      - directions: JSON list of direction/step strings
      - link: Source URL (optional)
      - source: Data source (optional, default: RecipeNLG)
      - NER: JSON list of named entities (optional)
      - index: Source index (optional)
    """
    title = (row.get("title") or "").strip()
    if not title:
        return None
    
    ingredients_list = safe_json_loads(row.get("ingredients", ""), default=[])
    directions_list = safe_json_loads(row.get("directions", ""), default=[])
    ner_list = safe_json_loads(row.get("NER", ""), default=[])

    # Normalize types
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

    # Fingerprint: deterministic hash of title + ingredients + directions
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
        "ner": ner_list,
        "link": link,
        "source": source,
        "source_id": source_id,
        "fingerprint": fingerprint,
    }


def connect_supabase():
    """Connect to Supabase and return client."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        raise RuntimeError(
            "Missing environment variables:\n"
            "  SUPABASE_URL\n"
            "  SUPABASE_SERVICE_ROLE_KEY"
        )

    # Use service role key for direct access (bypasses RLS)
    client = create_client(url, key)
    return client


def import_batch(
    client,
    user_id: str,
    batch_name: str,
    rows: List[Dict[str, Any]],
    batch_row_start_index: int,
) -> Tuple[int, int, int]:
    """
    Upsert recipes batch, then insert ingredients and steps.
    
    Returns (recipes_upserted, ingredients_inserted, steps_inserted)
    """
    recipes_upserted = 0
    ingredients_inserted = 0
    steps_inserted = 0
    
    # 1) Upsert recipes
    recipe_data = []
    fp_to_recipe = {}  # fingerprint -> recipe data for tracking
    
    for i, r in enumerate(rows):
        # Generate source_id if not present
        source_id = r.get("source_id") or str(batch_row_start_index + i)
        
        recipe_record = {
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
        }
        recipe_data.append(recipe_record)
        fp_to_recipe[r["fingerprint"]] = recipe_record
    
    # Upsert recipes using Supabase upsert
    try:
        # Check for existing recipes by fingerprint
        response = client.table("recipes").select(
            "id, fingerprint"
        ).in_("fingerprint", [r["fingerprint"] for r in recipe_data]).execute()
        
        existing_fps = {row["fingerprint"]: row["id"] for row in response.data}
        
        # Separate into insert and update
        to_insert = []
        to_update = []
        
        for recipe in recipe_data:
            if recipe["fingerprint"] in existing_fps:
                recipe["id"] = existing_fps[recipe["fingerprint"]]
                to_update.append(recipe)
            else:
                to_insert.append(recipe)
        
        # Insert new recipes
        if to_insert:
            insert_response = client.table("recipes").insert(to_insert).execute()
            recipes_upserted += len(insert_response.data)
            # Get the inserted IDs
            for inserted in insert_response.data:
                existing_fps[inserted["fingerprint"]] = inserted["id"]
        
        # Update existing recipes
        if to_update:
            for recipe in to_update:
                client.table("recipes").update(recipe).eq(
                    "fingerprint", recipe["fingerprint"]
                ).execute()
            recipes_upserted += len(to_update)
        
        # Get final recipe IDs
        recipe_ids = list(existing_fps.values())
        
    except Exception as e:
        print(f"❌ Error upserting recipes: {e}")
        raise
    
    # 2) Delete existing ingredients and steps (for clean re-import)
    try:
        # Delete ingredients
        client.table("recipe_ingredients").delete().in_("recipe_id", recipe_ids).execute()
        
        # Delete steps
        client.table("recipe_steps").delete().in_("recipe_id", recipe_ids).execute()
    except Exception as e:
        print(f"⚠️  Error cleaning old data: {e}")
        # Don't fail on cleanup errors
    
    # 3) Insert ingredients and steps
    ingredients_to_insert = []
    steps_to_insert = []
    
    for i, r in enumerate(rows):
        recipe_id = existing_fps.get(r["fingerprint"])
        if not recipe_id:
            continue
        
        ingredients_list: List[str] = r.get("ingredients") or []
        directions_list: List[str] = r.get("directions") or []
        ner_list: List[str] = r.get("ner") or []
        
        # Insert ingredients
        for idx, ing_line in enumerate(ingredients_list, start=1):
            ing_line_str = str(ing_line).strip()
            if not ing_line_str:
                continue
            
            name = ing_line_str[:300]
            
            # Try to match with NER list by index
            normalized_name = None
            if idx - 1 < len(ner_list):
                nn = str(ner_list[idx - 1]).strip()
                normalized_name = nn[:200] if nn else None
            
            ingredients_to_insert.append({
                "recipe_id": recipe_id,
                "user_id": user_id,
                "name": name,
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
        
        # Insert steps
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
    
    # Batch insert ingredients
    if ingredients_to_insert:
        try:
            client.table("recipe_ingredients").insert(ingredients_to_insert).execute()
            ingredients_inserted = len(ingredients_to_insert)
        except Exception as e:
            print(f"❌ Error inserting ingredients: {e}")
            raise
    
    # Batch insert steps
    if steps_to_insert:
        try:
            client.table("recipe_steps").insert(steps_to_insert).execute()
            steps_inserted = len(steps_to_insert)
        except Exception as e:
            print(f"❌ Error inserting steps: {e}")
            raise
    
    return recipes_upserted, ingredients_inserted, steps_inserted


def main():
    """Main import function."""
    user_id = os.environ.get("RECIPES_OWNER_USER_ID")
    csv_path = os.environ.get("CSV_PATH", "data/full_dataset.csv")
    batch_name = os.environ.get("IMPORT_BATCH", "recipenlg_full_dataset")
    batch_size = int(os.environ.get("BATCH_SIZE", "2000"))
    max_rows = int(os.environ.get("MAX_ROWS", "0"))
    
    if not user_id:
        print("❌ Missing RECIPES_OWNER_USER_ID environment variable")
        print("   Set it to a valid auth.users UUID")
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
    print()
    
    # Connect to Supabase
    try:
        client = connect_supabase()
        print("✅ Connected to Supabase")
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {e}")
        sys.exit(1)
    
    total_recipes = 0
    total_ings = 0
    total_steps = 0
    processed = 0
    
    start_time = time.time()
    
    try:
        with open(csv_path, "r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            
            if not reader.fieldnames:
                print("❌ CSV file is empty or invalid")
                sys.exit(1)
            
            print(f"✅ CSV columns: {', '.join(reader.fieldnames)}\n")
            
            buffer = []
            
            for row_num, row in enumerate(reader, start=2):
                parsed = parse_recipenlg_row(row)
                if not parsed:
                    continue
                
                buffer.append(parsed)
                processed += 1
                
                if max_rows and processed >= max_rows:
                    break
                
                if len(buffer) >= batch_size:
                    print(f"📤 Importing batch {processed // batch_size}...", end=" ", flush=True)
                    try:
                        r, i, s = import_batch(
                            client,
                            user_id,
                            batch_name,
                            buffer,
                            processed - len(buffer),
                        )
                        total_recipes += r
                        total_ings += i
                        total_steps += s
                        
                        elapsed = time.time() - start_time
                        rate = processed / elapsed if elapsed > 0 else 0
                        print(
                            f"✅ | rows={processed:,} upserted={total_recipes:,} "
                            f"ingredients={total_ings:,} steps={total_steps:,} | {rate:,.1f} rows/s"
                        )
                    except Exception as e:
                        print(f"❌ Batch failed: {e}")
                        raise
                    
                    buffer = []
            
            # Import remaining buffer
            if buffer:
                print(f"📤 Importing final batch...", end=" ", flush=True)
                try:
                    r, i, s = import_batch(
                        client,
                        user_id,
                        batch_name,
                        buffer,
                        processed - len(buffer),
                    )
                    total_recipes += r
                    total_ings += i
                    total_steps += s
                    
                    elapsed = time.time() - start_time
                    rate = processed / elapsed if elapsed > 0 else 0
                    print(
                        f"✅ | rows={processed:,} upserted={total_recipes:,} "
                        f"ingredients={total_ings:,} steps={total_steps:,} | {rate:,.1f} rows/s"
                    )
                except Exception as e:
                    print(f"❌ Final batch failed: {e}")
                    raise
        
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
        
    except KeyboardInterrupt:
        print("\n❌ Import interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Import failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
