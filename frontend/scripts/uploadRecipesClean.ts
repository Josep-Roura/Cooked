/**
 * Upload Recipes from CSV to Supabase - CLEAN VERSION
 *
 * Properly handles CSV parsing with quoted fields and inserts recipes
 * with their ingredients and steps in a reliable manner.
 *
 * Usage:
 *   cd frontend && npx tsx scripts/uploadRecipesClean.ts [CSV_PATH]
 */

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"
import * as readline from "readline"

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

/**
 * Parse a CSV line handling quoted fields properly
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
        // Escaped quote
        current += '"'
        i++ // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes
      }
    } else if (char === "," && !inQuotes) {
      // Comma outside quotes = field separator
      result.push(current)
      current = ""
    } else {
      current += char
    }
  }

  result.push(current)
  return result
}

/**
 * Parse a single recipe row from CSV
 */
function parseRecipeRow(headers: string[], values: string[]): ParsedRecipe | null {
  // Build a map of header -> value
  const rowData: Record<string, string> = {}
  headers.forEach((header, index) => {
    rowData[header.trim()] = values[index]?.trim() || ""
  })

  // Required fields
  const title = rowData["recipe_title"]
  if (!title) return null

  // Parse ingredients (columns ingredient_1_name through ingredient_5_name)
  const ingredients: ParsedRecipe["ingredients"] = []
  for (let i = 1; i <= 5; i++) {
    const nameKey = `ingredient_${i}_name`
    const qtyKey = `ingredient_${i}_qty`
    const unitKey = `ingredient_${i}_unit`
    const categoryKey = `ingredient_${i}_category`
    const optionalKey = `ingredient_${i}_optional`

    const name = rowData[nameKey]
    if (!name) continue // Skip if no ingredient name

    const qty = rowData[qtyKey]
    const quantity = qty && !isNaN(parseFloat(qty)) ? parseFloat(qty) : null
    const unit = rowData[unitKey] || null
    const category = rowData[categoryKey] || "other"
    const optional = rowData[optionalKey] === "1" || rowData[optionalKey]?.toLowerCase() === "true"

    ingredients.push({
      name,
      quantity,
      unit,
      category,
      optional,
    })
  }

  // Parse steps (columns step_1 through step_5)
  const steps: ParsedRecipe["steps"] = []
  for (let i = 1; i <= 5; i++) {
    const stepKey = `step_${i}`
    const instruction = rowData[stepKey]
    if (instruction) {
      steps.push({
        step_number: i,
        instruction,
      })
    }
  }

  // Parse other fields
  const servings = parseInt(rowData["servings"]) || 1
  const cookTimeMin = parseInt(rowData["cook_time_min"]) || null
  const tags = (rowData["tags"] || "")
    .split("|")
    .map((t) => t.trim())
    .filter((t) => t)

  return {
    title,
    description: rowData["description"] || "",
    category: rowData["category"] || "other",
    tags,
    emoji: rowData["emoji"] || "🍽️",
    servings,
    cook_time_min: cookTimeMin,
    ingredients,
    steps,
  }
}

/**
 * Upload recipes to Supabase
 */
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
  let duplicateCount = 0
  let errorCount = 0
  const failedRecipes: Array<{ title: string; error: string }> = []

  for await (const line of rl) {
    rowCount++

    // First line is headers
    if (rowCount === 1) {
      headers = parseCSVLine(line)
      console.log(`✅ Headers parsed: ${headers.length} columns\n`)
      continue
    }

    // Parse the CSV line
    const values = parseCSVLine(line)
    const recipe = parseRecipeRow(headers, values)

    if (!recipe) {
      continue // Skip empty rows
    }

    try {
      // Create canonical title
      const canonicalTitle = recipe.title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-z0-9\s]/g, "") // Remove special chars
        .trim()
        .replace(/\s+/g, "_") // Replace spaces with underscores

      // Check if recipe already exists
      const { data: existingRecipe, error: checkError } = await supabase
        .from("recipes")
        .select("id")
        .eq("user_id", OWNER_USER_ID)
        .eq("title", recipe.title)
        .single()

      let recipeId: string

      if (existingRecipe?.id) {
        // Recipe already exists, skip it
        duplicateCount++
        if ((successCount + duplicateCount) % 50 === 0) {
          const elapsed = Date.now() - startTime
          const total = successCount + duplicateCount
          const perSecond = total / (elapsed / 1000)
          console.log(`  📝 ${total} recipes processed (${duplicateCount} duplicates) - ${perSecond.toFixed(1)} recipes/sec`)
        }
        continue
      }

      // Insert new recipe
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
          macros_kcal: 0,
          macros_protein_g: 0,
          macros_carbs_g: 0,
          macros_fat_g: 0,
        })
        .select("id")
        .single()

      if (insertError) {
        throw new Error(`Recipe insert failed: ${insertError.message}`)
      }

      if (!inserted?.id) {
        throw new Error("No recipe ID returned")
      }

      recipeId = inserted.id

      // Insert ingredients (batch)
      if (recipe.ingredients.length > 0) {
        const ingredientRows = recipe.ingredients.map((ing, index) => ({
          recipe_id: recipeId,
          user_id: OWNER_USER_ID,
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          category: ing.category,
          optional: ing.optional,
          sort_order: index,
        }))

        const { error: ingError } = await supabase
          .from("recipe_ingredients")
          .insert(ingredientRows)

        if (ingError) {
          throw new Error(`Ingredients insert failed: ${ingError.message}`)
        }
      }

      // Insert steps (batch)
      if (recipe.steps.length > 0) {
        const stepRows = recipe.steps.map((step) => ({
          recipe_id: recipeId,
          user_id: OWNER_USER_ID,
          step_number: step.step_number,
          instruction: step.instruction,
        }))

        const { error: stepError } = await supabase
          .from("recipe_steps")
          .insert(stepRows)

        if (stepError) {
          throw new Error(`Steps insert failed: ${stepError.message}`)
        }
      }

      successCount++

      // Progress indicators
      if (successCount % 50 === 0) {
        const elapsed = Date.now() - startTime
        const perSecond = successCount / (elapsed / 1000)
        console.log(`  📝 ${successCount} recipes uploaded - ${perSecond.toFixed(1)} recipes/sec`)
      }
    } catch (error) {
      errorCount++
      failedRecipes.push({
        title: recipe.title,
        error: error instanceof Error ? error.message : String(error),
      })

      if (errorCount <= 5) {
        console.error(`  ❌ Error uploading "${recipe.title}": ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  // Final report
  console.log("\n" + "=".repeat(60))
  console.log("✅ UPLOAD COMPLETE!")
  console.log("=".repeat(60))
  const elapsed = Date.now() - startTime
  console.log(`⏱️  Total time: ${(elapsed / 1000 / 60).toFixed(1)} minutes`)
  console.log(`📊 Results:`)
  console.log(`   Total CSV rows: ${rowCount - 1}`)
  console.log(`   ✅ Successfully inserted: ${successCount}`)
  console.log(`   ⏭️  Duplicates skipped: ${duplicateCount}`)
  console.log(`   ❌ Failed: ${errorCount}`)
  console.log(`   💾 Location: recipes, recipe_ingredients, recipe_steps tables`)

  if (failedRecipes.length > 0 && failedRecipes.length <= 10) {
    console.log(`\n⚠️  Failed recipes:`)
    failedRecipes.forEach((f) => {
      console.log(`   - ${f.title}: ${f.error}`)
    })
  } else if (failedRecipes.length > 10) {
    console.log(`\n⚠️  ${failedRecipes.length} recipes failed (showing first 5):`)
    failedRecipes.slice(0, 5).forEach((f) => {
      console.log(`   - ${f.title}: ${f.error}`)
    })
  }

  if (errorCount > 0) {
    process.exit(1)
  }
}

uploadRecipes()
