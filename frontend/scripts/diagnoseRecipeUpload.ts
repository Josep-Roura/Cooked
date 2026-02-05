/**
 * Diagnose Recipe Upload Issues
 * 
 * Check current state of recipes, ingredients, and steps in the database.
 * Identify duplicates and data integrity issues.
 * 
 * Usage:
 *   cd frontend && npx tsx scripts/diagnoseRecipeUpload.ts
 */

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

// Load .env file
const envPath = path.join(__dirname, "../.env")
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8")
  envContent.split("\n").forEach((line) => {
    const [key, value] = line.split("=")
    if (key && value) {
      process.env[key.trim()] = value.trim()
    }
  })
}

const SUPABASE_URL = process.env.SUPABASE_URL || ""
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const OWNER_USER_ID = process.env.RECIPES_OWNER_USER_ID || "1b0f7431-5261-4414-b5de-6d9ee97b4e54"

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing environment variables:")
  console.error("   SUPABASE_URL")
  console.error("   SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

async function diagnose() {
  console.log("🔍 Diagnosing recipe upload state...\n")

  try {
    // 1. Count records
    console.log("📊 Record Counts:")
    const { count: recipeCount } = await supabase
      .from("recipes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", OWNER_USER_ID)

    const { count: ingredientCount } = await supabase
      .from("recipe_ingredients")
      .select("*", { count: "exact", head: true })
      .eq("user_id", OWNER_USER_ID)

    const { count: stepCount } = await supabase
      .from("recipe_steps")
      .select("*", { count: "exact", head: true })
      .eq("user_id", OWNER_USER_ID)

    console.log(`   Recipes: ${recipeCount || 0}`)
    console.log(`   Ingredients: ${ingredientCount || 0}`)
    console.log(`   Steps: ${stepCount || 0}`)
    console.log(`   Expected ingredients: ~${(recipeCount || 0) * 5} (5 per recipe)`)
    console.log(`   Expected steps: ~${(recipeCount || 0) * 4} (4 per recipe)\n`)

    // 2. Check for duplicate canonical_titles
    console.log("🔎 Checking for duplicate canonical_titles...")
    const { data: allRecipes, error: recipeError } = await supabase
      .from("recipes")
      .select("id, title, canonical_title")
      .eq("user_id", OWNER_USER_ID)

    if (recipeError) throw recipeError

    const titleCounts: Record<string, string[]> = {}
    allRecipes?.forEach((r) => {
      if (!titleCounts[r.canonical_title]) {
        titleCounts[r.canonical_title] = []
      }
      titleCounts[r.canonical_title].push(r.title)
    })

    const duplicates = Object.entries(titleCounts)
      .filter(([_, titles]) => titles.length > 1)
      .slice(0, 10)

    if (duplicates.length > 0) {
      console.log(`   ⚠️  Found ${Object.values(titleCounts).filter(t => t.length > 1).length} duplicate canonical_titles!`)
      console.log("   Sample duplicates:")
      duplicates.forEach(([canonical, titles]) => {
        console.log(`      "${canonical}": ${titles.join(", ")}`)
      })
    } else {
      console.log("   ✅ No duplicate canonical_titles found")
    }
    console.log()

    // 3. Check ingredients per recipe
    console.log("📈 Analyzing ingredients per recipe...")
    const { data: recipeIngredients, error: ingError } = await supabase
      .from("recipe_ingredients")
      .select("recipe_id")
      .eq("user_id", OWNER_USER_ID)

    if (ingError) throw ingError

    const ingredientsByRecipe: Record<string, number> = {}
    recipeIngredients?.forEach((ing) => {
      ingredientsByRecipe[ing.recipe_id] = (ingredientsByRecipe[ing.recipe_id] || 0) + 1
    })

    const avgIngredients = Object.values(ingredientsByRecipe).length > 0
      ? (Object.values(ingredientsByRecipe).reduce((a, b) => a + b, 0) / Object.values(ingredientsByRecipe).length).toFixed(2)
      : 0

    console.log(`   Average ingredients per recipe: ${avgIngredients}`)
    console.log(`   Min ingredients in a recipe: ${Math.min(...Object.values(ingredientsByRecipe), 0)}`)
    console.log(`   Max ingredients in a recipe: ${Math.max(...Object.values(ingredientsByRecipe), 0)}`)
    console.log()

    // 4. Check steps per recipe
    console.log("📈 Analyzing steps per recipe...")
    const { data: recipeSteps, error: stepError } = await supabase
      .from("recipe_steps")
      .select("recipe_id")
      .eq("user_id", OWNER_USER_ID)

    if (stepError) throw stepError

    const stepsByRecipe: Record<string, number> = {}
    recipeSteps?.forEach((step) => {
      stepsByRecipe[step.recipe_id] = (stepsByRecipe[step.recipe_id] || 0) + 1
    })

    const avgSteps = Object.values(stepsByRecipe).length > 0
      ? (Object.values(stepsByRecipe).reduce((a, b) => a + b, 0) / Object.values(stepsByRecipe).length).toFixed(2)
      : 0

    console.log(`   Average steps per recipe: ${avgSteps}`)
    console.log(`   Min steps in a recipe: ${Math.min(...Object.values(stepsByRecipe), 0)}`)
    console.log(`   Max steps in a recipe: ${Math.max(...Object.values(stepsByRecipe), 0)}`)
    console.log()

    // 5. Check for recipes without ingredients or steps
    console.log("🚨 Checking data integrity...")
    const recipesWithoutIngredients = (recipeCount || 0) - Object.keys(ingredientsByRecipe).length
    const recipesWithoutSteps = (recipeCount || 0) - Object.keys(stepsByRecipe).length

    console.log(`   Recipes without ingredients: ${recipesWithoutIngredients}`)
    console.log(`   Recipes without steps: ${recipesWithoutSteps}`)
    console.log()

    // 6. Check if all ingredients/steps have valid recipe_ids
    console.log("🔗 Checking referential integrity...")
    const validRecipeIds = new Set(allRecipes?.map((r) => r.id) || [])

    const invalidIngredients = ingredientsByRecipe 
      ? Object.keys(ingredientsByRecipe).filter(id => !validRecipeIds.has(id)).length 
      : 0
    const invalidSteps = stepsByRecipe 
      ? Object.keys(stepsByRecipe).filter(id => !validRecipeIds.has(id)).length 
      : 0

    console.log(`   Ingredients with invalid recipe_id: ${invalidIngredients}`)
    console.log(`   Steps with invalid recipe_id: ${invalidSteps}`)
    console.log()

    // Summary
    console.log("=" * 50)
    console.log("📋 SUMMARY:")
    console.log("=" * 50)
    if (recipeCount === 1200) {
      console.log("✅ All 1200 recipes successfully imported!")
    } else if (recipeCount === 503) {
      console.log("⚠️  Only 503 recipes imported (expected 1200)")
      console.log("   This suggests the upload was interrupted or there's a constraint violation")
    } else {
      console.log(`ℹ️  ${recipeCount} recipes imported`)
    }

  } catch (error) {
    console.error("❌ Error during diagnosis:", error)
    process.exit(1)
  }
}

diagnose()
