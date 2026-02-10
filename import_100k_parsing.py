#!/usr/bin/env python3
"""
RecipeNLG Import - 100K Recipes Only (con parseo de medidas)
- Importa las primeras 100,000 recetas
- Inserta recetas + ingredientes + pasos
- En ingredientes: separa cantidad / unidad / nombre y guarda raw_line
"""

import os
import csv
import json
import re
import uuid
from dataclasses import dataclass
from datetime import datetime
import logging
import time
from typing import Optional, Tuple, Dict, List

from supabase import create_client

# -----------------------------
# LOGGING
# -----------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(message)s",
    handlers=[logging.FileHandler("import_100k.log"), logging.StreamHandler()],
)
logger = logging.getLogger()

# -----------------------------
# SUPABASE
# -----------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
RECIPES_OWNER = os.getenv("RECIPES_OWNER_USER_ID", "1b0f7431-5261-4414-b5de-6d9ee97b4e54")

if not SUPABASE_URL or not SERVICE_ROLE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars")

supabase = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)

# -----------------------------
# CONFIG
# -----------------------------
CSV_PATH = os.getenv("CSV_PATH", "data/full_dataset.csv")
MAX_RECIPES = int(os.getenv("MAX_RECIPES", "100000"))
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "20"))

# -----------------------------
# PARSEO INGREDIENTES (adaptado a tu TOP 500)
# -----------------------------
UNIT_ALIASES: Dict[str, str] = {
    # tsp
    "tsp": "tsp", "tsp.": "tsp", "teaspoon": "tsp", "teaspoons": "tsp",
    # tbsp
    "tbsp": "tbsp", "tbsp.": "tbsp", "tablespoon": "tbsp", "tablespoons": "tbsp",
    # cup
    "c": "cup", "c.": "cup", "cup": "cup", "cups": "cup",
    # weight/volume common
    "lb": "lb", "lb.": "lb", "pound": "lb", "pounds": "lb",
    "oz": "oz", "oz.": "oz", "ounce": "oz", "ounces": "oz",
    "pt": "pt", "pt.": "pt", "pint": "pt", "pints": "pt",
    "qt": "qt", "qt.": "qt", "quart": "qt", "quarts": "qt",

    # container-ish
    "stick": "stick", "sticks": "stick",
    "pkg": "pkg", "pkg.": "pkg", "package": "pkg", "packages": "pkg",
    "box": "box", "boxes": "box",
    "can": "can", "cans": "can",
    "carton": "carton", "cartons": "carton",
    "container": "container", "containers": "container",
    "jar": "jar", "jars": "jar",

    # textos
    "dash": "dash",
    "pinch": "pinch",
}

UNICODE_FRACTIONS = {
    "¼": "1/4",
    "½": "1/2",
    "¾": "3/4",
    "⅓": "1/3",
    "⅔": "2/3",
    "⅛": "1/8",
    "⅜": "3/8",
    "⅝": "5/8",
    "⅞": "7/8",
}

REPLACEMENTS = [
    (r"\s+", " "),
    (r"^\s+|\s+$", ""),
]

PACKAGE_RE = re.compile(r"\(\s*([\d\.]+|[\d]+\s*\/\s*[\d]+)\s*([a-zA-Z\.]+)\s*\)")
LEADING_QTY_RE = re.compile(
    r"^\s*(?P<qty>(\d+\s+\d+\s*\/\s*\d+)|(\d+\s*\/\s*\d+)|(\d+(\.\d+)?))\b\s*(?P<rest>.*)$"
)
DASH_PINCH_RE = re.compile(r"^\s*(dash|pinch)\s+of\s+(.*)$", re.IGNORECASE)

@dataclass
class ParsedIng:
    quantity: Optional[float]
    unit: Optional[str]
    name: str
    quantity_text: Optional[str] = None
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
    qty_str = qty_str.strip()
    qty_str = re.sub(r"\s+", " ", qty_str)
    # mixed number "1 1/2"
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

def parse_ingredient(raw_line: str) -> ParsedIng:
    raw = normalize_text(raw_line or "")

    # dash/pinch of X
    m_dp = DASH_PINCH_RE.match(raw)
    if m_dp:
        unit = normalize_unit_token(m_dp.group(1))  # dash/pinch
        name = normalize_text(m_dp.group(2))
        return ParsedIng(quantity=1.0, unit=unit, name=name, quantity_text=m_dp.group(1).lower())

    # remove (8 oz.) etc
    raw_wo_pkg, pkg_qty, pkg_unit = remove_package_parens(raw)

    m = LEADING_QTY_RE.match(raw_wo_pkg)
    if not m:
        return ParsedIng(quantity=None, unit=None, name=raw_wo_pkg, quantity_text=None, package_qty=pkg_qty, package_unit=pkg_unit)

    qty_str = m.group("qty")
    rest = (m.group("rest") or "").strip()
    qty = parse_quantity(qty_str)
    qty_text = qty_str.strip()

    if not rest:
        return ParsedIng(quantity=qty, unit=None, name="", quantity_text=qty_text, package_qty=pkg_qty, package_unit=pkg_unit)

    parts = rest.split(" ", 1)
    first_tok = parts[0]
    unit = normalize_unit_token(first_tok)

    if unit is None:
        # e.g. "2 eggs", "1 medium onion"
        return ParsedIng(quantity=qty, unit=None, name=rest, quantity_text=qty_text, package_qty=pkg_qty, package_unit=pkg_unit)

    name = parts[1].strip() if len(parts) > 1 else ""
    if name.lower().startswith("of "):
        name = name[3:].strip()

    return ParsedIng(quantity=qty, unit=unit, name=name, quantity_text=qty_text, package_qty=pkg_qty, package_unit=pkg_unit)

# -----------------------------
# Helpers dataset
# -----------------------------
def parse_list(text: str) -> List[str]:
    """Parse JSON list string o comma-separated (fallback)."""
    text = (text or "").strip()
    if not text:
        return []
    if text.startswith("[") and text.endswith("]"):
        try:
            return [str(x).strip() for x in json.loads(text) if str(x).strip()]
        except Exception:
            pass
    return [x.strip() for x in text.split(",") if x.strip()]

def insert_data(table: str, data: list) -> bool:
    """Insert with retries."""
    if not data:
        return True
    for attempt in range(3):
        try:
            supabase.table(table).insert(data).execute()
            logger.info(f"✓ {table}: {len(data)}")
            return True
        except Exception as e:
            if attempt < 2:
                logger.warning(f"Retry {attempt+1} {table}: {str(e)[:120]}")
                time.sleep(3)
            else:
                logger.error(f"✗ {table}: {str(e)[:160]}")
                return False
    return False

# -----------------------------
# MAIN IMPORT
# -----------------------------
def main():
    logger.info("=" * 60)
    logger.info(f"Importando {MAX_RECIPES} recetas (con parseo de medidas)")
    logger.info("=" * 60)

    recipes_batch = []
    ings_batch = []
    steps_batch = []

    recipes_count = 0
    ings_count = 0
    steps_count = 0

    with open(CSV_PATH, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)

        for row in reader:
            if recipes_count >= MAX_RECIPES:
                break

            title = (row.get("title") or "").strip()
            source = (row.get("source") or "unknown").strip()
            link = (row.get("link") or "").strip()

            if not title or len(title) < 2:
                continue

            ings = parse_list(row.get("ingredients") or "")
            if not ings:
                continue

            dirs = parse_list(row.get("directions") or "")

            recipe_id = str(uuid.uuid4())
            now = datetime.now().isoformat()

            # Recipe
            recipes_batch.append({
                "id": recipe_id,
                "user_id": RECIPES_OWNER,
                "title": title[:200],
                "description": "",
                "servings": 1,
                "cook_time_min": None,
                "macros_kcal": 0,
                "macros_protein_g": 0,
                "macros_carbs_g": 0,
                "macros_fat_g": 0,
                "created_at": now,
                "updated_at": now,
                "emoji": None,
                "category": None,
                "tags": [],
                "diet_tags": [],
                "meal_tags": [],
                "canonical_title": str(uuid.uuid4()),
                "fingerprint": None,
                "source": source,
                "source_id": None,
                "source_url": link if link else None,
                "import_batch": "recipenlg_100k",
                "imported_at": now,
                "is_public": True,
                "language": "en",
            })

            # Ingredients (con separación de medidas)
            for i, raw_ing in enumerate(ings, 1):
                p = parse_ingredient(raw_ing)

                # Escoge el "name" final: si quedó vacío, usa el raw_line
                final_name = normalize_text(p.name) if p.name else normalize_text(raw_ing)

                ings_batch.append({
                    "id": str(uuid.uuid4()),
                    "recipe_id": recipe_id,
                    "user_id": RECIPES_OWNER,

                    # name "limpio"
                    "name": final_name[:500],

                    # opcional: guarda también quantity/unit "human"
                    "quantity": p.quantity,
                    "unit": p.unit,

                    # campos útiles para calidad y futuros macros
                    "raw_line": raw_ing,
                    "parsed_quantity": p.quantity,
                    "parsed_unit": p.unit,
                    "quantity_text": p.quantity_text or "",

                    # si tu tabla los tiene, se rellenan; si no, puedes quitar estas 2 líneas
                    "package_qty": p.package_qty,
                    "package_unit": p.package_unit,

                    "category": "other",
                    "optional": False,
                    "created_at": now,
                    "sort_order": i,
                })
                ings_count += 1

            # Steps (OJO: tu dataset a veces trae 1 solo "paso largo"; esto ya lo guarda tal cual)
            for i, step in enumerate(dirs, 1):
                st = (step or "").strip()
                if not st:
                    continue
                steps_batch.append({
                    "id": str(uuid.uuid4()),
                    "recipe_id": recipe_id,
                    "user_id": RECIPES_OWNER,
                    "step_number": i,
                    "instruction": st[:2000],
                    "timer_seconds": None,
                    "created_at": now,
                })
                steps_count += 1

            recipes_count += 1

            # Flush batch
            if len(recipes_batch) >= BATCH_SIZE:
                logger.info(f"[{recipes_count}/{MAX_RECIPES}] Insertando batch...")
                ok_r = insert_data("recipes", recipes_batch)
                time.sleep(0.4)
                ok_i = insert_data("recipe_ingredients", ings_batch)
                time.sleep(0.4)
                ok_s = insert_data("recipe_steps", steps_batch)
                time.sleep(0.4)

                # Si falla algo, lo dejas loggeado y sigues (o si prefieres, haz raise)
                if not (ok_r and ok_i and ok_s):
                    logger.warning("Batch con errores (revisa import_100k.log).")

                recipes_batch = []
                ings_batch = []
                steps_batch = []

    # Final batch
    if recipes_batch:
        logger.info("[FINAL] Insertando últimas recetas...")
        insert_data("recipes", recipes_batch)
        time.sleep(0.4)
        insert_data("recipe_ingredients", ings_batch)
        time.sleep(0.4)
        insert_data("recipe_steps", steps_batch)

    # Summary
    logger.info("=" * 60)
    logger.info("IMPORTACIÓN COMPLETADA")
    logger.info(f"  Recetas:      {recipes_count}")
    logger.info(f"  Ingredientes: {ings_count}")
    logger.info(f"  Pasos:        {steps_count}")
    logger.info("=" * 60)

if __name__ == "__main__":
    main()
