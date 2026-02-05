/**
 * Upload Recipes from CSV to Supabase
 *
 * This script parses the cookedflow_recetas_mejoradas_1200.csv file
 * and uploads recipes, ingredients, and steps to the Supabase database.
 *
 * Usage:
 *   cd frontend && npx tsx scripts/uploadRecipes.ts [CSV_PATH]
 *
 * Environment variables:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
 *   RECIPES_OWNER_USER_ID - User ID to assign recipes to (defaults to "system")
 */

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as readline from "readline"

const SUPABASE_URL = process.env.SUPABASE_URL || ""
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const OWNER_USER_ID = process.env.RECIPES_OWNER_USER_ID || "1b0f7431-5261-4414-b5de-6d9ee97b4e54"

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing environment variables:")
  console.error("   SUPABASE_URL")
  console.error("   SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

// Get CSV path from args or use default
const csvPath = process.argv[2] || "../data/cookedflow_recetas_mejoradas_1200.csv"

if (!fs.existsSync(csvPath)) {
  console.error(`❌ CSV file not found: ${csvPath}`)
  process.exit(1)
}

// Initialize Supabase
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
  notes: string
}

/**
 * Parse a CSV line handling quoted fields
 */
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
        i++ // Skip next quote
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

/**
 * Parse a single recipe row from CSV
 */
function parseRecipeRow(headers: string[], values: string[]): ParsedRecipe | null {
  // Create a map of header -> value
  const rowData: Record<string, string> = {}
  headers.forEach((header, index) => {
    rowData[header] = values[index] || ""
  })

  // Required fields
  const title = rowData.recipe_title?.trim()
  if (!title) return null

  // Parse ingredients (numbered columns)
  const ingredients: ParsedRecipe["ingredients"] = []
  let ingredientIndex = 1
  while (true) {
    const nameKey = `ingredient_${ingredientIndex}_name`
    const qtyKey = `ingredient_${ingredientIndex}_qty`
    const unitKey = `ingredient_${ingredientIndex}_unit`
    const categoryKey = `ingredient_${ingredientIndex}_category`
    const optionalKey = `ingredient_${ingredientIndex}_optional`

    if (!(nameKey in rowData)) break

    const name = rowData[nameKey]?.trim()
    if (!name) {
      ingredientIndex++
      continue
    }

    const qty = rowData[qtyKey]?.trim()
    const quantity = qty && !isNaN(parseFloat(qty)) ? parseFloat(qty) : null

    const unit = rowData[unitKey]?.trim() || null
    const category = rowData[categoryKey]?.trim() || "other"
    const optional = rowData[optionalKey] === "1" || rowData[optionalKey]?.toLowerCase() === "true"

    ingredients.push({
      name,
      quantity,
      unit,
      category,
      optional,
    })

    ingredientIndex++
  }

  // Parse steps (numbered columns)
  const steps: ParsedRecipe["steps"] = []
  for (let i = 1; i <= 5; i++) {
    const stepKey = `step_${i}`
    const instruction = rowData[stepKey]?.trim()
    if (instruction) {
      steps.push({
        step_number: i,
        instruction,
      })
    }
  }

  // Parse other fields
  const servings = parseInt(rowData.servings) || 1
  const cookTimeMin = parseInt(rowData.cook_time_min) || null
  const tags = rowData.tags
    ?.split("|")
    .map((t) => t.trim())
    .filter((t) => t) || []

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
    notes: rowData.notes?.trim() || "",
  }
}

/**
 * Upload recipes to Supabase
 */
async function uploadRecipes() {
  console.log(`📖 Reading recipes from: ${csvPath}`)

  const fileStream = fs.createReadStream(csvPath)
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  })

  let headers: string[] = []
  let rowCount = 0
  let successCount = 0
  let skipCount = 0

  for await (const line of rl) {
    rowCount++

    // First line is headers
    if (rowCount === 1) {
      headers = parseCSVLine(line)
      console.log(`✅ Headers parsed: ${headers.length} columns`)
      continue
    }

    // Parse the CSV line
    const values = parseCSVLine(line)
    const recipe = parseRecipeRow(headers, values)

    if (!recipe) {
      skipCount++
      continue
    }

    try {
      // Check if recipe already exists (to avoid duplicates)
      const { data: existingRecipe, error: checkError } = await supabase
        .from("recipes")
        .select("id")
        .eq("title", recipe.title)
        .eq("user_id", OWNER_USER_ID)
        .single()

      let recipeData: any

      if (existingRecipe?.id) {
        // Recipe exists, update it
        const { data: updated, error: updateError } = await supabase
          .from("recipes")
          .update({
            description: recipe.description,
            category: recipe.category,
            emoji: recipe.emoji,
            servings: recipe.servings,
            cook_time_min: recipe.cook_time_min,
          })
          .eq("id", existingRecipe.id)
          .select("*")
          .single()

        if (updateError) {
          console.error(`❌ Error updating recipe "${recipe.title}":`, updateError.message)
          skipCount++
          continue
        }
        recipeData = updated
      } else {
        // Recipe doesn't exist, insert it
        const canonicalTitle = recipe.title
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "") // Remove accents
          .replace(/[^a-z0-9\s]/g, "") // Remove special chars
          .trim()
          .replace(/\s+/g, "_") // Replace spaces with underscores

        const { data: inserted, error: insertError } = await supabase
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
            macros_kcal: 0, // Not in CSV, would need to be calculated
            macros_protein_g: 0,
            macros_carbs_g: 0,
            macros_fat_g: 0,
          })
          .select("*")
          .single()

        if (insertError) {
          console.error(`❌ Error inserting recipe "${recipe.title}":`, insertError.message)
          skipCount++
          continue
        }
        recipeData = inserted
      }

      if (!recipeData?.id) {
        console.error(`❌ No recipe ID returned for "${recipe.title}"`)
        skipCount++
        continue
      }

      // Insert ingredients
      if (recipe.ingredients.length > 0) {
        const ingredientRows = recipe.ingredients.map((ing, index) => ({
          recipe_id: recipeData.id,
          user_id: OWNER_USER_ID,
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          category: ing.category,
          optional: ing.optional,
          sort_order: index,
        }))

        const { error: ingredientError } = await supabase.from("recipe_ingredients").insert(ingredientRows)

        if (ingredientError) {
          console.error(`⚠️  Error inserting ingredients for "${recipe.title}":`, ingredientError.message)
        }
      }

      // Insert steps
      if (recipe.steps.length > 0) {
        const stepRows = recipe.steps.map((step) => ({
          recipe_id: recipeData.id,
          user_id: OWNER_USER_ID,
          step_number: step.step_number,
          instruction: step.instruction,
        }))

        const { error: stepError } = await supabase.from("recipe_steps").insert(stepRows)

        if (stepError) {
          console.error(`⚠️  Error inserting steps for "${recipe.title}":`, stepError.message)
        }
      }

      successCount++

      if (successCount % 50 === 0) {
        console.log(`  📝 ${successCount} recipes uploaded...`)
      }
    } catch (error) {
      console.error(`❌ Unexpected error processing recipe "${recipe.title}":`, error)
      skipCount++
    }
  }

  console.log("\n✅ Upload complete!")
  console.log(`  📊 Total rows: ${rowCount - 1}`)
  console.log(`  ✅ Successful: ${successCount}`)
  console.log(`  ⏭️  Skipped: ${skipCount}`)
  console.log(`  💾 Location: recipes, recipe_ingredients, recipe_steps tables`)
}

// Run the upload
uploadRecipes().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
