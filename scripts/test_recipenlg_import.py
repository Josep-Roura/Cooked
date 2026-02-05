#!/usr/bin/env python3
"""
Quick test of the RecipeNLG import script.

Tests:
  1. Environment variables
  2. CSV file access
  3. CSV parsing
  4. Supabase connectivity
  5. Sample recipe parsing
"""

import os
import sys
import csv
import json

def test_env_vars():
    """Check environment variables."""
    print("🔍 Testing environment variables...")
    vars_needed = [
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "RECIPES_OWNER_USER_ID",
    ]
    
    missing = []
    for var in vars_needed:
        value = os.environ.get(var)
        if value:
            print(f"  ✅ {var}: {value[:30]}...")
        else:
            print(f"  ❌ {var}: MISSING")
            missing.append(var)
    
    if missing:
        print(f"\n❌ Missing variables: {', '.join(missing)}")
        print("   Set them in .env or export them:")
        for var in missing:
            print(f"     export {var}=value")
        return False
    
    print()
    return True


def test_csv_file():
    """Check CSV file exists and is readable."""
    print("📂 Testing CSV file...")
    csv_path = os.environ.get("CSV_PATH", "data/full_dataset.csv")
    
    if not os.path.exists(csv_path):
        print(f"  ❌ File not found: {csv_path}")
        return False
    
    size_mb = os.path.getsize(csv_path) / (1024 * 1024)
    print(f"  ✅ File exists: {csv_path} ({size_mb:.1f} MB)")
    
    # Try to read first few rows
    try:
        with open(csv_path, "r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            fields = reader.fieldnames or []
            print(f"  ✅ CSV columns: {len(fields)} fields")
            if fields:
                print(f"     {', '.join(fields[:5])}...")
            
            # Read first few rows
            rows_read = 0
            for row in reader:
                rows_read += 1
                if rows_read >= 3:
                    break
            
            print(f"  ✅ Successfully read {rows_read} rows")
    except Exception as e:
        print(f"  ❌ Error reading CSV: {e}")
        return False
    
    print()
    return True


def test_csv_parsing():
    """Test parsing of RecipeNLG rows."""
    print("🔄 Testing CSV parsing...")
    
    sys.path.insert(0, os.path.dirname(__file__))
    from import_recipenlg import parse_recipenlg_row, safe_json_loads
    
    csv_path = os.environ.get("CSV_PATH", "data/full_dataset.csv")
    
    try:
        with open(csv_path, "r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            
            parsed_count = 0
            row_count = 0
            for i, row in enumerate(reader):
                row_count = i
                if i >= 10:  # Test first 10
                    break
                
                parsed = parse_recipenlg_row(row)
                if parsed:
                    parsed_count += 1
                    if i < 2:  # Show details for first 2
                        print(f"  ✅ Row {i+2}: '{parsed['title']}'")
                        print(f"     - {len(parsed['ingredients'])} ingredients")
                        print(f"     - {len(parsed['directions'])} directions")
            
            print(f"  ✅ Successfully parsed {parsed_count} out of {min(10, row_count+1)} rows")
    except Exception as e:
        print(f"  ❌ Error parsing CSV: {e}")
        return False
    
    print()
    return True


def test_supabase():
    """Test Supabase connectivity."""
    print("🔗 Testing Supabase connectivity...")
    
    try:
        from import_recipenlg import connect_supabase
        client = connect_supabase()
        print("  ✅ Connected to Supabase")
        
        # Try a simple query
        try:
            response = client.table("recipes").select("id").limit(1).execute()
            print(f"  ✅ Recipes table accessible")
        except Exception as e:
            print(f"  ⚠️  Could not query recipes table: {e}")
            print("     (This might be OK if the table doesn't exist yet)")
    
    except Exception as e:
        print(f"  ❌ Connection failed: {e}")
        return False
    
    print()
    return True


def main():
    """Run all tests."""
    print("=" * 70)
    print("🧪 RecipeNLG Import Script Tests")
    print("=" * 70)
    print()
    
    results = []
    
    results.append(("Environment variables", test_env_vars()))
    results.append(("CSV file", test_csv_file()))
    results.append(("CSV parsing", test_csv_parsing()))
    results.append(("Supabase connection", test_supabase()))
    
    print("=" * 70)
    print("📋 Summary")
    print("=" * 70)
    
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {name}")
    
    all_passed = all(passed for _, passed in results)
    
    print()
    if all_passed:
        print("✅ All tests passed! Ready to run import_recipenlg.py")
        print()
        print("Run import with:")
        print("  python scripts/import_recipenlg.py")
        sys.exit(0)
    else:
        print("❌ Some tests failed. Please fix issues before running import.")
        sys.exit(1)


if __name__ == "__main__":
    main()
