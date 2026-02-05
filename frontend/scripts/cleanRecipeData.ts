/**
 * Clean Recipe Data
 * 
 * Deletes all recipes, ingredients, and steps for the specified user
 * to start fresh with a clean upload.
 * 
 * Usage:
 *   cd frontend && npx tsx scripts/cleanRecipeData.ts
 */

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

// Load .env
const envPath = path.join(process.cwd(), ".env")
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
  console.error("❌ Missing environment variables")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

async function cleanData() {
  console.log("🧹 Cleaning recipe data...")
  console.log(`   User ID: ${OWNER_USER_ID}\n`)

  try {
    // 1. Count existing data
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

    console.log(`📊 Current data:`)
    console.log(`   Recipes: ${recipeCount || 0}`)
    console.log(`   Ingredients: ${ingredientCount || 0}`)
    console.log(`   Steps: ${stepCount || 0}\n`)

    if (!recipeCount && !ingredientCount && !stepCount) {
      console.log("✅ Database is already clean!")
      return
    }

    console.log("🗑️  Deleting data...\n")

    // 2. Delete in order: steps, ingredients, recipes (due to FK constraints)
    const { error: stepError } = await supabase
      .from("recipe_steps")
      .delete()
      .eq("user_id", OWNER_USER_ID)

    if (stepError) {
      console.error("❌ Error deleting steps:", stepError.message)
      throw stepError
    }
    console.log("   ✅ Deleted steps")

    const { error: ingredientError } = await supabase
      .from("recipe_ingredients")
      .delete()
      .eq("user_id", OWNER_USER_ID)

    if (ingredientError) {
      console.error("❌ Error deleting ingredients:", ingredientError.message)
      throw ingredientError
    }
    console.log("   ✅ Deleted ingredients")

    const { error: recipeError } = await supabase
      .from("recipes")
      .delete()
      .eq("user_id", OWNER_USER_ID)

    if (recipeError) {
      console.error("❌ Error deleting recipes:", recipeError.message)
      throw recipeError
    }
    console.log("   ✅ Deleted recipes")

    // 3. Verify deletion
    const { count: verifyRecipes } = await supabase
      .from("recipes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", OWNER_USER_ID)

    console.log(`\n✅ Cleanup complete!`)
    console.log(`   Recipes remaining: ${verifyRecipes || 0}`)
  } catch (error) {
    console.error("❌ Cleanup failed:", error)
    process.exit(1)
  }
}

cleanData()
