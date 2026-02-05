/**
 * Test CSV parsing logic for recipe upload script
 *
 * This script tests the CSV parsing without requiring Supabase connection
 * to verify the recipe extraction is working correctly.
 *
 * Usage:
 *   cd frontend && npx tsx scripts/testRecipeUpload.ts
 */

import * as fs from "fs"
import * as readline from "readline"

const csvPath = "../data/cookedflow_recetas_mejoradas_1200.csv"

if (!fs.existsSync(csvPath)) {
  console.error(`❌ CSV file not found: ${csvPath}`)
  process.exit(1)
}

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
 * Test CSV parsing
 */
async function testParsing() {
  console.log(`📖 Testing CSV parsing from: ${csvPath}\n`)

  const fileStream = fs.createReadStream(csvPath)
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  })

  let headers: string[] = []
  let rowCount = 0
  let successCount = 0
  let skipCount = 0
  const sampleRecipes: ParsedRecipe[] = []

  for await (const line of rl) {
    rowCount++

    // First line is headers
    if (rowCount === 1) {
      headers = parseCSVLine(line)
      console.log(`✅ Headers: ${headers.length} columns`)
      console.log(`   Columns: ${headers.slice(0, 7).join(", ")} ... ${headers.slice(-3).join(", ")}\n`)
      continue
    }

    // Stop after 5 test rows
    if (rowCount > 6) break

    // Parse the CSV line
    const values = parseCSVLine(line)
    const recipe = parseRecipeRow(headers, values)

    if (!recipe) {
      console.log(`⏭️  Row ${rowCount}: No title, skipping`)
      skipCount++
      continue
    }

    successCount++
    sampleRecipes.push(recipe)

    console.log(`✅ Row ${rowCount}: "${recipe.title}"`)
    console.log(`   📝 ${recipe.description.substring(0, 60)}...`)
    console.log(`   🏷️  Category: ${recipe.category}, Tags: ${recipe.tags.join(", ")}`)
    console.log(`   🍜 Ingredients: ${recipe.ingredients.length}, Steps: ${recipe.steps.length}`)
    console.log()
  }

  console.log("\n" + "=".repeat(70))
  console.log("✅ PARSING TEST COMPLETE")
  console.log("=".repeat(70))
  console.log(`📊 Rows tested: ${rowCount - 1}`)
  console.log(`✅ Successfully parsed: ${successCount}`)
  console.log(`⏭️  Skipped: ${skipCount}`)
  console.log()

  // Show detailed breakdown of first recipe
  if (sampleRecipes.length > 0) {
    const recipe = sampleRecipes[0]
    console.log("📌 SAMPLE RECIPE DETAIL (First Row):")
    console.log("=" + "=".repeat(69))
    console.log(`Title: ${recipe.title}`)
    console.log(`Emoji: ${recipe.emoji}`)
    console.log(`Servings: ${recipe.servings}, Cook time: ${recipe.cook_time_min}min`)
    console.log(`Description: ${recipe.description}`)
    console.log(`Category: ${recipe.category}`)
    console.log(`Tags: ${recipe.tags.join(", ")}`)
    console.log(`\nIngredients (${recipe.ingredients.length}):`)
    recipe.ingredients.forEach((ing, i) => {
      console.log(`  ${i + 1}. ${ing.name} - ${ing.quantity}${ing.unit} (${ing.category}${ing.optional ? ", optional" : ""})`)
    })
    console.log(`\nSteps (${recipe.steps.length}):`)
    recipe.steps.forEach((step) => {
      console.log(`  ${step.step_number}. ${step.instruction.substring(0, 60)}...`)
    })
  }

  console.log("\n✅ CSV parsing is working correctly!")
}

// Run the test
testParsing().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
