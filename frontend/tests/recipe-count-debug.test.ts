import { test } from "node:test"

test("Debug: Check how many breakfast recipes exist", () => {
  // We need to manually check the breakfast recipes in the recipes array
  // Based on the code, breakfast array starts at line 204
  
  // Let's calculate what the modulo should result in:
  const weekSeed1 = 249600
  const weekSeed2 = 854400
  const dayOfWeek = 0
  const mealIndexInDay = 0
  
  // Assuming we have ~14 breakfast recipes (from the summary)
  const testLengths = [14, 12, 10, 8]
  
  console.log("\nTesting different recipe counts:")
  for (const length of testLengths) {
    const uniqueIndex1 = (weekSeed1 * 7919 + dayOfWeek * 13 + mealIndexInDay * 97) % length
    const uniqueIndex2 = (weekSeed2 * 7919 + dayOfWeek * 13 + mealIndexInDay * 97) % length
    console.log(`\n  Length ${length}:`)
    console.log(`    Week 1 index: ${uniqueIndex1}`)
    console.log(`    Week 2 index: ${uniqueIndex2}`)
    console.log(`    Different? ${uniqueIndex1 !== uniqueIndex2}`)
  }
  
  // Calculate the raw values before modulo
  const raw1 = weekSeed1 * 7919 + dayOfWeek * 13 + mealIndexInDay * 97
  const raw2 = weekSeed2 * 7919 + dayOfWeek * 13 + mealIndexInDay * 97
  console.log(`\nRaw calculation (before modulo):`)
  console.log(`  Week 1: ${raw1}`)
  console.log(`  Week 2: ${raw2}`)
  console.log(`  Difference: ${raw2 - raw1}`)
})
