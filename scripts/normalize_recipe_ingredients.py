#!/usr/bin/env python3
"""
CookedFlow / RecipeNLG Ingredient Normalizer (Supabase REST API)

✅ Optimizado para Supabase REST API:
- Fetch por batches
- Evita updates inútiles (solo actualiza si cambia algo)
- Parser adaptado a tu TOP 500 (tsp/tbsp/cup/c, lb/oz/pt/qt, stick/pkg/box/can/carton/container/jar, dash/pinch, etc.)

USO:
  export SUPABASE_URL="https://..."
  export SUPABASE_SERVICE_ROLE_KEY="..."
  export BATCH_SIZE=200
  export MAX_ROWS=0
  python3 scripts/normalize_recipe_ingredients.py
"""

import os
import re
from dataclasses import dataclass
from typing import Optional, Tuple, Dict, Any, List

from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "200"))
MAX_ROWS = int(os.getenv("MAX_ROWS", "0"))  # 0 = unlimited

if not SUPABASE_URL or not SERVICE_ROLE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment")

supabase = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)

# -----------------------------
# Parsing config (adaptado a tu TOP 500)
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

    # container-ish (muy frecuente en tu top 500)
    "stick": "stick", "sticks": "stick",
    "pkg": "pkg", "pkg.": "pkg", "package": "pkg", "packages": "pkg",
    "box": "box", "boxes": "box",
    "can": "can", "cans": "can",
    "carton": "carton", "cartons": "carton",
    "container": "container", "containers": "container",
    "jar": "jar", "jars": "jar",

    # típicos
    "dash": "dash",
    "pinch": "pinch",
}

# Replacements simples
REPLACEMENTS = [
    (r"\s+", " "),
    (r"^\s+|\s+$", ""),
]

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

# (8 oz.) / (14 oz.) etc
PACKAGE_RE = re.compile(r"\(\s*([\d\.]+|[\d]+\s*\/\s*[\d]+|\d+\s+\d+\s*\/\s*\d+)\s*([a-zA-Z\.]+)\s*\)")

# quantity at start:
# - 1
# - 1.5
# - 1/2
# - 1 1/2
LEADING_QTY_RE = re.compile(
    r"^\s*(?P<qty>(\d+\s+\d+\s*\/\s*\d+)|(\d+\s*\/\s*\d+)|(\d+(\.\d+)?))\b\s*(?P<rest>.*)$"
)

# dash/pinch of salt
DASH_PINCH_RE = re.compile(r"^\s*(dash|pinch)\s+of\s+(.*)$", re.IGNORECASE)

# If text starts with "salt and pepper", "pepper to taste", etc: keep qty/unit null.
NO_QTY_PREFIX = re.compile(r"^(salt|pepper|water|flour|sugar)\b", re.IGNORECASE)


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
    # unicode fractions
    for uf, rep in UNICODE_FRACTIONS.items():
        s = s.replace(uf, rep)
    # normalize weird dashes
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
    """
    Extract first (X unit) occurrence like (8 oz.)
    Return: (string with that removed), package_qty, package_unit
    """
    m = PACKAGE_RE.search(s)
    if not m:
        return s, None, None

    qty_raw = m.group(1)
    unit_raw = m.group(2)

    pkg_qty = parse_quantity(qty_raw)
    pkg_unit = normalize_unit_token(unit_raw)

    # remove matched parens
    s2 = (s[:m.start()] + s[m.end():]).strip()
    s2 = re.sub(r"\s+", " ", s2).strip()
    return s2, pkg_qty, pkg_unit


def parse_raw_line(raw_line: str) -> Parsed:
    raw = normalize_text(raw_line or "")

    if not raw:
        return Parsed(quantity=None, unit=None, name="", package_qty=None, package_unit=None)

    # Common "salt to taste" etc: don't force qty
    # (we keep as name only)
    if NO_QTY_PREFIX.match(raw) and ("to taste" in raw.lower() or "and pepper" in raw.lower()):
        return Parsed(quantity=None, unit=None, name=raw)

    # dash/pinch pattern (no numeric qty)
    m_dp = DASH_PINCH_RE.match(raw)
    if m_dp:
        unit = normalize_unit_token(m_dp.group(1))
        name = m_dp.group(2).strip()
        # represent dash/pinch as qty=1 + unit=dash/pinch
        return Parsed(quantity=1.0, unit=unit, name=name)

    # extract package parens first: "1 (8 oz.) pkg. cream cheese"
    raw_wo_pkg, pkg_qty, pkg_unit = remove_package_parens(raw)

    # leading quantity?
    m = LEADING_QTY_RE.match(raw_wo_pkg)
    if not m:
        return Parsed(quantity=None, unit=None, name=raw_wo_pkg, package_qty=pkg_qty, package_unit=pkg_unit)

    qty_str = m.group("qty")
    rest = (m.group("rest") or "").strip()
    qty = parse_quantity(qty_str)

    if not rest:
        return Parsed(quantity=qty, unit=None, name="", package_qty=pkg_qty, package_unit=pkg_unit)

    # token after qty might be a unit
    parts = rest.split(" ", 1)
    first_tok = parts[0]
    unit = normalize_unit_token(first_tok)

    if unit is None:
        # IMPORTANT: if token isn't a known unit => it's name (e.g., "2 eggs", "1 medium onion")
        return Parsed(quantity=qty, unit=None, name=rest, package_qty=pkg_qty, package_unit=pkg_unit)

    name = parts[1].strip() if len(parts) > 1 else ""
    if name.lower().startswith("of "):
        name = name[3:].strip()

    return Parsed(quantity=qty, unit=unit, name=name, package_qty=pkg_qty, package_unit=pkg_unit)


# -----------------------------
# DB update (Supabase REST API)
# -----------------------------

def main() -> None:
    processed = 0
    batch_num = 0
    offset = 0

    try:
        while True:
            batch_num += 1

            # Fetch batch
            response = supabase.table("recipe_ingredients").select(
                "id, raw_line, name, parsed_quantity, parsed_unit, package_qty, package_unit"
            ).is_("name", "null").is_("raw_line", "not_null").limit(BATCH_SIZE).offset(offset).execute()

            rows = response.data or []

            if not rows:
                print("✅ Done. No more rows pending.")
                break

            updates = []

            for r in rows:
                _id = r["id"]
                raw_line = r["raw_line"] or ""
                p = parse_raw_line(raw_line)

                # cleanup
                name_new = normalize_text(p.name)

                # compare old vs new to avoid useless writes
                old_name = (r["name"] or "")
                if (
                    r["parsed_quantity"] == p.quantity
                    and r["parsed_unit"] == p.unit
                    and old_name == name_new
                    and r["package_qty"] == p.package_qty
                    and r["package_unit"] == p.package_unit
                ):
                    continue

                updates.append({
                    "id": _id,
                    "parsed_quantity": p.quantity,
                    "parsed_unit": p.unit,
                    "name": name_new,
                    "package_qty": p.package_qty,
                    "package_unit": p.package_unit,
                })

            if not updates:
                print(f"Batch {batch_num}: 0 updates (rows fetched={len(rows)}).")
                offset += BATCH_SIZE
            else:
                # Upsert updates
                supabase.table("recipe_ingredients").upsert(updates).execute()
                processed += len(updates)
                print(f"Batch {batch_num}: updated {len(updates)} rows (total updated: {processed})")
                offset += BATCH_SIZE

            if MAX_ROWS > 0 and processed >= MAX_ROWS:
                print(f"🛑 MAX_ROWS reached ({MAX_ROWS}). Stopping.")
                break

    except KeyboardInterrupt:
        print("Interrupted.")
    except Exception as e:
        print(f"Error: {e}")
        raise


if __name__ == "__main__":
    main()
