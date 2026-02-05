#!/usr/bin/env python3
"""
Diagnose RecipeNLG import results.

Checks database for imported recipes and provides stats.
"""

import os
import sys


def diagnose():
    """Check what was imported."""
    print("🔍 Diagnosing RecipeNLG Import...\n")
    
    try:
        from import_recipenlg import connect_supabase
        
        user_id = os.environ.get("RECIPES_OWNER_USER_ID")
        if not user_id:
            print("❌ Missing RECIPES_OWNER_USER_ID environment variable")
            return False
        
        client = connect_supabase()
        
        # Get counts using actual data fetching
        print("📊 Database Counts:")
        
        try:
            recipes_data = client.table("recipes").select(
                "id"
            ).eq("source", "RecipeNLG").execute()
            recipe_count = len(recipes_data.data or [])
            print(f"   Recipes (RecipeNLG): {recipe_count:,}")
        except Exception as e:
            print(f"   ⚠️  Could not count recipes: {e}")
            recipe_count = 0
        
        try:
            ings_data = client.table("recipe_ingredients").select(
                "id"
            ).execute()
            ing_count = len(ings_data.data or [])
            print(f"   Ingredients: {ing_count:,}")
        except Exception as e:
            print(f"   ⚠️  Could not count ingredients: {e}")
            ing_count = 0
        
        try:
            steps_data = client.table("recipe_steps").select(
                "id"
            ).execute()
            step_count = len(steps_data.data or [])
            print(f"   Steps: {step_count:,}")
        except Exception as e:
            print(f"   ⚠️  Could not count steps: {e}")
            step_count = 0
        
        print()
        
        # Check for duplicates
        print("📈 Statistics:")
        if recipe_count > 0:
            print(f"   Avg ingredients per recipe: {ing_count / recipe_count:.2f}")
            print(f"   Avg steps per recipe: {step_count / recipe_count:.2f}")
        
        # Sample recipes
        print()
        print("🔎 Sample Recipes:")
        
        try:
            sample_data = client.table("recipes").select(
                "id, title, source_id, created_at"
            ).eq("source", "RecipeNLG").order(
                "created_at", desc=False
            ).limit(5).execute()
            
            for recipe in sample_data.data or []:
                title = recipe.get("title", "Untitled")[:50]
                print(f"   - {title}")
                
                # Get ingredient count
                try:
                    ings = client.table("recipe_ingredients").select(
                        "id"
                    ).eq("recipe_id", recipe.get("id")).execute()
                    ing_c = len(ings.data or [])
                    print(f"     ({ing_c} ingredients)")
                except Exception:
                    print(f"     (? ingredients)")
        except Exception as e:
            print(f"   ⚠️  Could not fetch sample recipes: {e}")
        
        print()
        print("✅ Diagnosis complete!")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    if diagnose():
        sys.exit(0)
    else:
        sys.exit(1)
