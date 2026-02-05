#!/usr/bin/env python3
"""
RecipeNLG Import Script v3.4 (UPSERT Version)
Handles 2M recipes with upsert to avoid constraint violations
"""

import os
import sys
import csv
import json
import re
import uuid
from typing import Optional, Tuple, Dict, List
from datetime import datetime
import logging
import hashlib

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('import_v3.4.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

try:
    from supabase import create_client
    logger.info("Supabase client imported successfully")
except ImportError as e:
    logger.error(f"Import error: {e}")
    sys.exit(1)

# Initialize Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
RECIPES_OWNER_USER_ID = os.getenv("RECIPES_OWNER_USER_ID", "1b0f7431-5261-4414-b5de-6d9ee97b4e54")

if not SUPABASE_URL or not SERVICE_ROLE_KEY:
    logger.error("Environment variables required")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)
logger.info(f"Connected to Supabase")

# Configuration
CSV_PATH = os.getenv("CSV_PATH", "data/full_dataset.csv")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "100"))
ING_CHUNK_SIZE = int(os.getenv("ING_CHUNK_SIZE", "500"))
STEPS_CHUNK_SIZE = int(os.getenv("STEPS_CHUNK_SIZE", "500"))
MAX_ROWS = int(os.getenv("MAX_ROWS", "0"))
PURGE_BEFORE_IMPORT = int(os.getenv("PURGE_BEFORE_IMPORT", "1"))

logger.info(f"Config: BATCH={BATCH_SIZE}, CSV={CSV_PATH}, MAX_ROWS={MAX_ROWS}")

def parse_ingredient_line(line: str) -> Dict:
    """Parse ingredient line"""
    if not line:
        return {'name': '', 'quantity': None, 'unit': ''}
    
    line = line.strip()
    
    # Try to extract quantity
    match = re.match(r'^([\d.]+(?:\s*\/\s*\d+)?)', line)
    qty = None
    if match:
        try:
            qty_str = match.group(1)
            if '/' in qty_str:
                parts = qty_str.split('/')
                qty = float(parts[0].strip()) / float(parts[1].strip())
            else:
                qty = float(qty_str)
            remaining = line[len(match.group(1)):].strip()
        except:
            remaining = line
    else:
        remaining = line
    
    # Extract unit
    unit = ''
    name = remaining
    if remaining:
        parts = remaining.split(maxsplit=1)
        if parts and len(parts[0]) < 10:  # Units are usually short
            potential_unit = parts[0]
            common_units = ['g', 'kg', 'ml', 'l', 'cup', 'cups', 'tbsp', 'tsp', 'oz', 'lb']
            if any(potential_unit.lower().startswith(cu) for cu in common_units):
                unit = potential_unit
                name = parts[1] if len(parts) > 1 else ''
    
    return {
        'name': name or line,
        'quantity': qty,
        'unit': unit if unit else None
    }

def purge_database():
    """Delete all recipes"""
    logger.info("Purging database...")
    try:
        response = supabase.table('recipes').select('id').execute()
        ids = [row['id'] for row in response.data] if response.data else []
        
        if ids:
            logger.info(f"Deleting {len(ids)} recipes")
            for i in range(0, len(ids), 1000):
                batch = ids[i:i+1000]
                supabase.table('recipes').delete().in_('id', batch).execute()
        
        logger.info("Purge complete")
    except Exception as e:
        logger.error(f"Purge error: {e}")

def import_recipes():
    """Import recipes from CSV"""
    if not os.path.exists(CSV_PATH):
        logger.error(f"CSV not found: {CSV_PATH}")
        return
    
    if PURGE_BEFORE_IMPORT:
        purge_database()
    
    logger.info(f"Starting import...")
    
    batch_recipes = []
    recipe_count = 0
    error_count = 0
    start_time = datetime.now()
    
    try:
        with open(CSV_PATH, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f)
            
            for row_idx, row in enumerate(reader):
                if MAX_ROWS > 0 and recipe_count >= MAX_ROWS:
                    break
                
                try:
                    # Extract fields with proper handling
                    title = str(row.get('title') or '').strip()
                    source = str(row.get('source') or 'unknown').strip()
                    ingredients_text = str(row.get('ingredients') or '').strip()
                    directions = str(row.get('directions') or '').strip()
                    
                    # Skip if essential fields are empty
                    if not title or len(title) < 2:
                        continue
                    if not ingredients_text or len(ingredients_text) < 2:
                        continue
                    
                    # Parse ingredients
                    ingredients_list = []
                    if ingredients_text.startswith('['):
                        try:
                            ingredients_list = json.loads(ingredients_text)
                        except:
                            ingredients_list = [ing.strip() for ing in ingredients_text.split(',')]
                    else:
                        ingredients_list = [ing.strip() for ing in ingredients_text.split(',')]
                    
                    ingredients_list = [ing for ing in ingredients_list if ing and len(ing) > 1]
                    
                    if not ingredients_list:
                        continue
                    
                    # Create unique title
                    unique_title = f"{title[:80]}[{source[:20]}#{row_idx}]"
                    
                    # Create recipe
                    recipe = {
                        'user_id': RECIPES_OWNER_USER_ID,
                        'title': unique_title,
                        'canonical_title': str(uuid.uuid4()),
                        'description': '',
                        'servings': 1,
                        'cook_time_min': None,
                        'macros_kcal': 0,
                        'macros_protein_g': 0,
                        'macros_carbs_g': 0,
                        'macros_fat_g': 0,
                        'created_at': datetime.now().isoformat(),
                        'updated_at': datetime.now().isoformat(),
                        '__ingredients': ingredients_list,
                        '__directions': directions
                    }
                    
                    batch_recipes.append(recipe)
                    recipe_count += 1
                    
                    # Process batch
                    if len(batch_recipes) >= BATCH_SIZE:
                        _process_batch(batch_recipes)
                        batch_recipes = []
                    
                    # Log progress
                    if recipe_count % 10000 == 0:
                        elapsed = (datetime.now() - start_time).total_seconds()
                        rate = recipe_count / elapsed if elapsed > 0 else 0
                        logger.info(f"Processed {recipe_count} recipes ({rate:.1f}/sec)")
                
                except Exception as e:
                    error_count += 1
                    if error_count <= 5:
                        logger.warning(f"Row {row_idx}: {e}")
        
        # Process final batch
        if batch_recipes:
            _process_batch(batch_recipes)
        
        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info(f"\nComplete! {recipe_count} recipes in {elapsed:.0f}s ({recipe_count/elapsed:.1f}/sec)")
        logger.info(f"Errors: {error_count}")
    
    except Exception as e:
        logger.error(f"Fatal: {e}", exc_info=True)

def _process_batch(recipes):
    """Process batch of recipes"""
    try:
        # Extract metadata
        ingredients_list = [r.pop('__ingredients', []) for r in recipes]
        directions_list = [r.pop('__directions', '') for r in recipes]
        
        # Insert recipes with upsert
        response = supabase.table('recipes').upsert(
            recipes,
            ignore_duplicates=False
        ).execute()
        
        inserted = response.data if response.data else []
        logger.info(f"Inserted {len(inserted)} recipes")
        
        # Prepare ingredients and steps
        all_ingredients = []
        all_steps = []
        
        for recipe, ingredients, directions in zip(inserted, ingredients_list, directions_list):
            recipe_id = recipe.get('id')
            if not recipe_id:
                continue
            
            user_id = recipe.get('user_id')
            
            # Add ingredients
            for ing_text in ingredients:
                parsed = parse_ingredient_line(ing_text)
                all_ingredients.append({
                    'recipe_id': recipe_id,
                    'user_id': user_id,
                    'name': parsed['name'],
                    'quantity': parsed['quantity'],
                    'unit': parsed['unit'],
                    'category': 'other',
                    'optional': False,
                    'created_at': datetime.now().isoformat()
                })
            
            # Add steps
            for step_idx, step_text in enumerate([d.strip() for d in directions.split('\n') if d.strip()], 1):
                all_steps.append({
                    'recipe_id': recipe_id,
                    'user_id': user_id,
                    'step_number': step_idx,
                    'instruction': step_text,
                    'timer_seconds': None,
                    'created_at': datetime.now().isoformat()
                })
        
        # Insert ingredients
        if all_ingredients:
            for i in range(0, len(all_ingredients), ING_CHUNK_SIZE):
                chunk = all_ingredients[i:i+ING_CHUNK_SIZE]
                supabase.table('recipe_ingredients').insert(chunk).execute()
            logger.info(f"Inserted {len(all_ingredients)} ingredients")
        
        # Insert steps
        if all_steps:
            for i in range(0, len(all_steps), STEPS_CHUNK_SIZE):
                chunk = all_steps[i:i+STEPS_CHUNK_SIZE]
                supabase.table('recipe_steps').insert(chunk).execute()
            logger.info(f"Inserted {len(all_steps)} steps")
    
    except Exception as e:
        logger.error(f"Batch error: {e}")

if __name__ == '__main__':
    logger.info("RecipeNLG Import v3.4 started")
    import_recipes()
    logger.info("RecipeNLG Import v3.4 finished")
