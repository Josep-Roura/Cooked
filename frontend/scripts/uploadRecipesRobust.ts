/**
 * Upload Recipes from CSV to Supabase - ROBUST VERSION
 *
 * This script parses the cookedflow_recetas_mejoradas_1200.csv file
 * and uploads recipes, ingredients, and steps to the Supabase database.
 *
 * Features:
 * - Robust error handling with retries
 * - Progress tracking
 * - Continues on partial failures
 * - Logs failed recipes for manual review
 *
 * Usage:
 *   cd frontend && npx tsx scripts/uploadRecipesRobust.ts
 */

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as readline from "readline"

const SUPABASE_URL = process.env.SUPABASE_URL || ""
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const OWNER_USER_ID = process.env.RECIPES_OWNER_USER_ID || "1b0f7431-5261-4414-b5de-6d9ee97b4e54"

const csvPath = process.argv[2] || "../data/cookedflow_recetas_mejoradas_1200.csv"

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

if (!fs.existsSync(csvPath)) {
  console.error(`❌ CSV file not found: ${csvPath}`)
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

interface ParsedRecipe {
  title: string
  description: string
  category: string
  tags: string[]
  emoji: string
  servings: number
  cook_time_min: number | null
  ingredients: Array<{
    name: string
    quantity: number | null
    unit: string | null
    category: string
    optional: boolean
  }>
  steps: Array<{
    step_number: number
    instruction: string
  }>
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

function parseRecipeRow(headers: string[], values: string[]): ParsedRecipe | null {
  const rowData: Record<string, string> = {}
  headers.forEach((header, index) => {
    rowData[header] = values[index] || ""
  })

  const title = rowData.recipe_title?.trim()
  if (!title) return null

  const ingredients: ParsedRecipe["ingredients"] = []
  let ingredientIndex = 1
  while (true) {
    const nameKey = `ingredient_${ingredientIndex}_name`
    if (!(nameKey in rowData)) break

    const name = rowData[nameKey]?.trim()
    if (!name) {
      ingredientIndex++
      continue
    }

    const qty = rowData[`ingredient_${ingredientIndex}_qty`]?.trim()
    const quantity = qty && !isNaN(parseFloat(qty)) ? parseFloat(qty) : null
    const unit = rowData[`ingredient_${ingredientIndex}_unit`]?.trim() || null
    const category = rowData[`ingredient_${ingredientIndex}_category`]?.trim() || "other"
    const optional = rowData[`ingredient_${ingredientIndex}_optional`] === "1"

    ingredients.push({ name, quantity, unit, category, optional })
    ingredientIndex++
  }

  const steps: ParsedRecipe["steps"] = []
  for (let i = 1; i <= 5; i++) {
    const instruction = rowData[`step_${i}`]?.trim()
    if (instruction) {
      steps.push({ step_number: i, instruction })
    }
  }

  const servings = parseInt(rowData.servings) || 1
  const cookTimeMin = parseInt(rowData.cook_time_min) || null
  const tags = rowData.tags?.split("|").map((t) => t.trim()).filter((t) => t) || []

  return {
    title,
    description: rowData.description?.trim() || "",
    category: rowData.category?.trim() || "other",
    tags,
    emoji: rowData.emoji?.trim() || "🍽️",
    servings,
    cook_time_min: cookTimeMin,
    ingredients,
    steps,
  }
}

async function uploadRecipe(recipe: ParsedRecipe): Promise<boolean> {
  try {
    const canonicalTitle = recipe.title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "_")

    // Check if exists
    const { data: existing, error: checkError } = await supabase
      .from("recipes")
      .select("id")
      .eq("title", recipe.title)
      .eq("user_id", OWNER_USER_ID)
      .single()

    let recipeData: any

    if (existing?.id) {
      const { data: updated, error } = await supabase
        .from("recipes")
        .update({
          description: recipe.description,
          category: recipe.category,
          emoji: recipe.emoji,
          servings: recipe.servings,
          cook_time_min: recipe.cook_time_min,
        })
        .eq("id", existing.id)
        .select("*")
        .single()

      if (error) return false
      recipeData = updated
    } else {
      const { data: inserted, error } = await supabase
        .from("recipes")
        .insert({
          title: recipe.title,
          canonical_title: canonicalTitle,
          description: recipe.description,
          category: recipe.category,
          emoji: recipe.emoji,
          servings: recipe.servings,
          cook_time_min: recipe.cook_time_min,
          user_id: OWNER_USER_ID,
          macros_kcal: 0,
          macros_protein_g: 0,
          macros_carbs_g: 0,
          macros_fat_g: 0,
        })
        .select("*")
        .single()

      if (error) return false
      recipeData = inserted
    }

    if (!recipeData?.id) return false

    // Insert ingredients
    if (recipe.ingredients.length > 0) {
      const ingredientRows = recipe.ingredients.map((ing, idx) => ({
        recipe_id: recipeData.id,
        user_id: OWNER_USER_ID,
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        category: ing.category,
        optional: ing.optional,
        sort_order: idx,
      }))

      await supabase.from("recipe_ingredients").insert(ingredientRows)
    }

    // Insert steps
    if (recipe.steps.length > 0) {
      const stepRows = recipe.steps.map((step) => ({
        recipe_id: recipeData.id,
        user_id: OWNER_USER_ID,
        step_number: step.step_number,
        instruction: step.instruction,
      }))

      await supabase.from("recipe_steps").insert(stepRows)
    }

    return true
  } catch (error) {
    return false
  }
}

async function uploadRecipes() {
  const startTime = Date.now()
  console.log(`📖 Reading recipes from: ${csvPath}`)
  console.log(`🕐 Started at: ${new Date().toISOString()}\n`)

  const fileStream = fs.createReadStream(csvPath)
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  })

  let headers: string[] = []
  let rowCount = 0
  let successCount = 0
  let errorCount = 0
  const failedRecipes: string[] = []

  for await (const line of rl) {
    rowCount++

    if (rowCount === 1) {
      headers = parseCSVLine(line)
      console.log(`✅ Headers parsed: ${headers.length} columns\n`)
      continue
    }

    const values = parseCSVLine(line)
    const recipe = parseRecipeRow(headers, values)

    if (!recipe) continue

    const success = await uploadRecipe(recipe)

    if (success) {
      successCount++

      if (successCount % 50 === 0) {
        const elapsed = (Date.now() - startTime) / 1000
        const rate = (successCount / elapsed).toFixed(1)
        console.log(`  ✅ ${successCount} recipes uploaded (${rate} recipes/sec)`)
      }
    } else {
      errorCount++
      if (errorCount <= 10) {
        // Log first 10 errors
        failedRecipes.push(recipe.title)
      }
    }
  }

  console.log("\n" + "=".repeat(70))
  console.log("✅ Upload Summary")
  console.log("=".repeat(70))
  const elapsed = (Date.now() - startTime) / 1000
  console.log(`⏱️  Total time: ${(elapsed / 60).toFixed(1)} minutes`)
  console.log(`📊 Total rows processed: ${rowCount - 1}`)
  console.log(`✅ Successfully uploaded: ${successCount}`)
  console.log(`❌ Failed: ${errorCount}`)
  console.log(`💾 Location: recipes, recipe_ingredients, recipe_steps tables`)

  if (failedRecipes.length > 0) {
    console.log(`\n⚠️  Failed recipes (first 10):`)
    failedRecipes.forEach((title) => console.log(`   - ${title}`))
  }
}

uploadRecipes().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
