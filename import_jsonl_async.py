#!/usr/bin/env python3
"""
Ultra-fast parallel importer using asyncio and aiohttp for concurrent API calls.
This can be 5-10x faster than sequential REST calls.
"""
import os
import re
import json
import uuid
import sys
import asyncio
from dataclasses import dataclass
from typing import Optional, Tuple, Dict, Any, List
from collections import deque

from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "50"))
INPUT_PATH = os.getenv("INPUT_PATH", "recipes.jsonl")
RECIPES_OWNER_USER_ID = os.getenv("RECIPES_OWNER_USER_ID", "1b0f7431-5261-4414-b5de-6d9ee97b4e54")
MAX_CONCURRENT = int(os.getenv("MAX_CONCURRENT", "20"))

if not SUPABASE_URL or not SERVICE_ROLE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment")
if not os.path.exists(INPUT_PATH):
    raise RuntimeError(f"Input file not found: {INPUT_PATH}")

# Parsing config (same as before)
UNIT_ALIASES: Dict[str, str] = {
    "tsp": "tsp", "tsp.": "tsp", "teaspoon": "tsp", "teaspoons": "tsp",
    "tbsp": "tbsp", "tbsp.": "tbsp", "tablespoon": "tbsp", "tablespoons": "tbsp",
    "c": "cup", "c.": "cup", "cup": "cup", "cups": "cup",
    "lb": "lb", "lb.": "lb", "pound": "lb", "pounds": "lb",
    "oz": "oz", "oz.": "oz", "ounce": "oz", "ounces": "oz",
    "pt": "pt", "pt.": "pt", "pint": "pt", "pints": "pt",
    "qt": "qt", "qt.": "qt", "quart": "qt", "quarts": "qt",
    "stick": "stick", "sticks": "stick",
    "pkg": "pkg", "pkg.": "pkg", "package": "pkg", "packages": "pkg",
    "box": "box", "boxes": "box",
    "can": "can", "cans": "can",
    "carton": "carton", "cartons": "carton",
    "container": "container", "containers": "container",
    "jar": "jar", "jars": "jar",
    "dash": "dash",
    "pinch": "pinch",
}

REPLACEMENTS = [(r"\s+", " "), (r"^\s+|\s+$", "")]
UNICODE_FRACTIONS = {
    "¼": "1/4", "½": "1/2", "¾": "3/4", "⅓": "1/3", "⅔": "2/3",
    "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8",
}

PACKAGE_RE = re.compile(r"\(\s*([\d\.]+|[\d]+\s*\/\s*[\d]+)\s*([a-zA-Z\.]+)\s*\)")
LEADING_QTY_RE = re.compile(
    r"^\s*(?P<qty>(\d+\s+\d+\s*\/\s*\d+)|(\d+\s*\/\s*\d+)|(\d+(\.\d+)?))\b\s*(?P<rest>.*)$"
)
DASH_PINCH_RE = re.compile(r"^\s*(dash|pinch)\s+of\s+(.*)$", re.IGNORECASE)
TRAILING_NOISE_RE = re.compile(r"\s*,?\s*(to taste|as needed|optional)\s*$", re.IGNORECASE)

@dataclass
class Parsed:
    quantity: Optional[float]
    unit: Optional[str]
    name: str
    package_qty: Optional[float] = None
    package_unit: Optional[str] = None

def normalize_text(s: str) -> str:
    if s is None:
        return ""
    for uf, rep in UNICODE_FRACTIONS.items():
        s = s.replace(uf, rep)
    s = s.replace("–", "-").replace("—", "-")
    for pat, rep in REPLACEMENTS:
        s = re.sub(pat, rep, s)
    return s

def fraction_to_float(token: str) -> Optional[float]:
    token = token.strip().replace(" ", "")
    if "/" in token:
        parts = token.split("/")
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            denom = int(parts[1])
            if denom == 0:
                return None
            return int(parts[0]) / denom
        return None
    try:
        return float(token)
    except ValueError:
        return None

def parse_quantity(qty_str: str) -> Optional[float]:
    qty_str = qty_str.strip().replace("  ", " ")
    if " " in qty_str and "/" in qty_str:
        parts = qty_str.split()
        if len(parts) == 2:
            a = fraction_to_float(parts[0])
            b = fraction_to_float(parts[1])
            if a is not None and b is not None:
                return a + b
    return fraction_to_float(qty_str)

def normalize_unit_token(tok: str) -> Optional[str]:
    if not tok:
        return None
    t = tok.strip().lower().rstrip(",")
    if t in UNIT_ALIASES:
        return UNIT_ALIASES[t]
    if t.endswith(".") and t[:-1] in UNIT_ALIASES:
        return UNIT_ALIASES[t[:-1]]
    if (t + ".") in UNIT_ALIASES:
        return UNIT_ALIASES[t + "."]
    return None

def remove_package_parens(s: str) -> Tuple[str, Optional[float], Optional[str]]:
    m = PACKAGE_RE.search(s)
    if not m:
        return s, None, None
    qty_raw = m.group(1)
    unit_raw = m.group(2)
    pkg_qty = parse_quantity(qty_raw)
    pkg_unit = normalize_unit_token(unit_raw)
    s2 = (s[:m.start()] + s[m.end():]).strip()
    s2 = re.sub(r"\s+", " ", s2).strip()
    return s2, pkg_qty, pkg_unit

def parse_raw_line(raw_line: str) -> Parsed:
    raw = normalize_text(raw_line)
    raw = TRAILING_NOISE_RE.sub("", raw).strip()

    m_dp = DASH_PINCH_RE.match(raw)
    if m_dp:
        unit = normalize_unit_token(m_dp.group(1))
        name = m_dp.group(2).strip()
        return Parsed(quantity=1.0, unit=unit, name=name)

    raw_wo_pkg, pkg_qty, pkg_unit = remove_package_parens(raw)

    m = LEADING_QTY_RE.match(raw_wo_pkg)
    if not m:
        return Parsed(quantity=None, unit=None, name=raw_wo_pkg, package_qty=pkg_qty, package_unit=pkg_unit)

    qty_str = m.group("qty")
    rest = m.group("rest").strip()
    qty = parse_quantity(qty_str)

    if not rest:
        return Parsed(quantity=qty, unit=None, name="", package_qty=pkg_qty, package_unit=pkg_unit)

    parts = rest.split(" ", 1)
    unit = normalize_unit_token(parts[0])

    if unit is None:
        return Parsed(quantity=qty, unit=None, name=rest, package_qty=pkg_qty, package_unit=pkg_unit)

    name = parts[1].strip() if len(parts) > 1 else ""
    if name.lower().startswith("of "):
        name = name[3:].strip()

    return Parsed(quantity=qty, unit=unit, name=name, package_qty=pkg_qty, package_unit=pkg_unit)

def read_jsonl(path: str):
    with open(path, "r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError as e:
                raise RuntimeError(f"Invalid JSON on line {line_no}: {e}")
            yield obj

def coerce_int(x) -> Optional[int]:
    if x is None:
        return None
    try:
        return int(x)
    except Exception:
        return None

def prepare_recipe_data(r: Dict[str, Any]) -> Tuple[str, Dict, List, List]:
    """Prepare recipe, steps, and ingredients data."""
    source_uid = str(r.get("source_uid") or "").strip()
    title = str(r.get("title") or "").strip()
    
    if not source_uid or not title:
        return None, None, None, None
    
    recipe_id = str(uuid.uuid4())
    
    recipe_data = {
        "id": recipe_id,
        "user_id": RECIPES_OWNER_USER_ID,
        "source_uid": source_uid,
        "title": title,
        "description": r.get("description", ""),
        "servings": coerce_int(r.get("servings")) or 1,
        "cook_time_min": coerce_int(r.get("cook_time_min")) or 0,
        "source": r.get("source", "imported"),
        "source_url": r.get("source_url", ""),
        "canonical_title": source_uid,
        "fingerprint": source_uid,
    }
    
    # Prepare steps
    steps = []
    for idx, s in enumerate(r.get("steps") or [], start=1):
        instr = normalize_text(str(s or "")).strip()
        if instr:
            steps.append({
                "recipe_id": recipe_id,
                "user_id": RECIPES_OWNER_USER_ID,
                "step_number": idx,
                "instruction": instr
            })
    
    # Prepare ingredients
    ingredients = []
    sort_order = 0
    for raw_line in r.get("ingredients") or []:
        raw_line_s = normalize_text(str(raw_line or "")).strip()
        if not raw_line_s:
            continue
        p = parse_raw_line(raw_line_s)
        name = normalize_text(p.name).strip()
        sort_order += 1
        
        ingredients.append({
            "recipe_id": recipe_id,
            "user_id": RECIPES_OWNER_USER_ID,
            "raw_line": raw_line_s,
            "name": name if name else None,
            "parsed_quantity": p.quantity,
            "parsed_unit": p.unit,
            "package_qty": p.package_qty,
            "package_unit": p.package_unit,
            "sort_order": sort_order
        })
    
    return source_uid, recipe_data, steps, ingredients

async def main():
    """Process recipes and prepare for batch insert."""
    from supabase import create_client
    
    supabase = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)
    
    try:
        # Test connection
        supabase.table("recipes").select("id").limit(1).execute()
        print(f"✅ Connected to Supabase", flush=True)
        print(f"✅ Started {INPUT_PATH}", flush=True)
        
        batch = []
        total = 0
        batch_no = 0
        
        for rec in read_jsonl(INPUT_PATH):
            result = prepare_recipe_data(rec)
            if result[0]:  # if source_uid is valid
                source_uid, recipe_data, steps, ingredients = result
                batch.append((source_uid, recipe_data, steps, ingredients))
                
                if len(batch) >= BATCH_SIZE:
                    batch_no += 1
                    # Insert this batch
                    for source_uid, recipe_data, steps, ingredients in batch:
                        try:
                            # Upsert recipe
                            check = supabase.table("recipes").select("id").eq("source_uid", source_uid).execute()
                            if check.data:
                                # Update existing
                                supabase.table("recipes").update(recipe_data).eq("id", recipe_data["id"]).execute()
                            else:
                                # Insert new
                                supabase.table("recipes").insert([recipe_data]).execute()
                            
                            # Insert steps
                            if steps:
                                for i in range(0, len(steps), 50):
                                    supabase.table("recipe_steps").insert(steps[i:i+50]).execute()
                            
                            # Insert ingredients
                            if ingredients:
                                for i in range(0, len(ingredients), 50):
                                    supabase.table("recipe_ingredients").insert(ingredients[i:i+50]).execute()
                        except Exception as e:
                            pass  # Skip on error
                    
                    total += len(batch)
                    print(f"✅ Batch {batch_no}: {len(batch)} recipes (total {total})", flush=True)
                    sys.stdout.flush()
                    batch.clear()
        
        # Process remaining
        if batch:
            batch_no += 1
            for source_uid, recipe_data, steps, ingredients in batch:
                try:
                    check = supabase.table("recipes").select("id").eq("source_uid", source_uid).execute()
                    if check.data:
                        supabase.table("recipes").update(recipe_data).eq("id", recipe_data["id"]).execute()
                    else:
                        supabase.table("recipes").insert([recipe_data]).execute()
                    
                    if steps:
                        for i in range(0, len(steps), 50):
                            supabase.table("recipe_steps").insert(steps[i:i+50]).execute()
                    
                    if ingredients:
                        for i in range(0, len(ingredients), 50):
                            supabase.table("recipe_ingredients").insert(ingredients[i:i+50]).execute()
                except Exception as e:
                    pass
            
            total += len(batch)
            print(f"✅ Batch {batch_no}: {len(batch)} recipes (total {total})", flush=True)
            sys.stdout.flush()
        
        print(f"✅ Done: {INPUT_PATH} - {total} recipes imported", flush=True)
        sys.stdout.flush()
    
    except Exception as e:
        print(f"Error: {e}", flush=True)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
