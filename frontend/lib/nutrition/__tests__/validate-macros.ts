import { generateSportsNutritionistPrompt, type NutritionistContext } from "../ai-nutritionist-prompt"

/**
 * Validation script to verify macro calculation guidelines
 * Ensures ACSM/ISSN/IOC 2023 standards are properly integrated
 */

// Helper to create test context
function createContext(overrides: Partial<NutritionistContext>): NutritionistContext {
  const defaults: NutritionistContext = {
    athleteName: "Test Athlete",
    weight_kg: 70, // Standard 70kg athlete
    age: 30,
    sex: "male",
    experience_level: "intermediate",
    sweat_rate: "medium",
    gi_sensitivity: "low",
    caffeine_use: "some",
    primary_goal: "performance",
    workoutType: "mixed",
    durationMinutes: 60,
    intensity: "moderate",
    description: "Test workout",
    country: "USA",
    availableProducts: [],
  }
  return { ...defaults, ...overrides }
}

// Test results
const results: { passed: number; failed: number; tests: Array<{ name: string; passed: boolean }> } = {
  passed: 0,
  failed: 0,
  tests: [],
}

// Test helper
function testGuideline(name: string, checkFn: () => boolean) {
  try {
    const passed = checkFn()
    if (passed) {
      console.log(`✅ ${name}`)
      results.passed++
    } else {
      console.log(`❌ ${name}`)
      results.failed++
    }
    results.tests.push({ name, passed })
  } catch (error) {
    console.log(`❌ ${name}: ${error}`)
    results.failed++
    results.tests.push({ name, passed: false })
  }
}

console.log("\n📋 MACRO CALCULATION GUIDELINES VALIDATION (ACSM/ISSN/IOC 2023)\n")
console.log("=" + "=".repeat(80) + "\n")

// Test 1: Pre-workout carbs for <60 min sessions
testGuideline("Pre-workout carbs for <60 min sessions (1-4g/kg, use 70-140g)", () => {
  const context = createContext({ durationMinutes: 45, intensity: "moderate" })
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("1-4g carbs/kg") && prompt.includes("70-140g")
})

// Test 2: Pre-workout carbs for 60-90 min sessions
testGuideline("Pre-workout carbs for 60-90 min sessions (1-4g/kg)", () => {
  const context = createContext({ durationMinutes: 75 })
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("1-4g carbs/kg") && prompt.includes("70-140g")
})

// Test 3: Pre-workout carbs for >90 min sessions
testGuideline("Pre-workout carbs for >90 min sessions (2-4g/kg, use 140-280g)", () => {
  const context = createContext({ durationMinutes: 120 })
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("2-4g carbs/kg") && prompt.includes("140-280g")
})

// Test 4: Pre-workout protein (0.25-0.4g/kg)
testGuideline("Pre-workout protein (0.25-0.4g/kg = 17-28g for 70kg)", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("0.25-0.4g/kg") && prompt.includes("17-28g") && prompt.includes("saciedad")
})

// Test 5: Pre-workout fats limit (≤1g/kg)
testGuideline("Pre-workout fat limit (≤1g/kg = max 70g for 70kg)", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("≤1g/kg") && prompt.includes("70g") && prompt.includes("GI")
})

// Test 6: During-workout <60 min (water only)
testGuideline("During-workout <60 min (water + electrolytes, 0g carbs)", () => {
  const context = createContext({ durationMinutes: 45 })
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("< 60 min") && prompt.includes("150-250ml cada 15-20 min") && prompt.includes("0g")
})

// Test 7: During-workout 60-90 min (30-60g carbs/hour)
testGuideline("During-workout 60-90 min (30-60g carbs/hour)", () => {
  const context = createContext({ durationMinutes: 75 })
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("60-90 min") && prompt.includes("30-60g/hora") && prompt.includes("500-750ml/hora")
})

// Test 8: During-workout >90 min (60-90g carbs/hour, multiple sources)
testGuideline("During-workout >90 min (60-90g carbs/hour, up to 120g with multiple sources)", () => {
  const context = createContext({ durationMinutes: 120 })
  const prompt = generateSportsNutritionistPrompt(context)
  return (
    prompt.includes("> 90 min") &&
    prompt.includes("60-90g/hora") &&
    prompt.includes("glucose + fructose") &&
    prompt.includes("120g/h")
  )
})

// Test 9: During-workout hydration by sweat_rate
testGuideline("During-workout hydration by sweat_rate (Low: 400-500, Medium: 600-800, High: 800-1000)", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("400-500ml/hora") && prompt.includes("600-800ml/hora") && prompt.includes("800-1000ml/hora")
})

// Test 10: During-workout sodium guidelines
testGuideline("During-workout sodium (300-700mg/hour, max 1000mg/hour for hot climate)", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("300-700mg/hora") && prompt.includes("1000mg/hora")
})

// Test 11: Post-workout carbs (1.0-1.2g/kg = 70-84g for 70kg)
testGuideline("Post-workout carbs (1.0-1.2g/kg = 70-84g for 70kg)", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("1.0-1.2g/kg") && prompt.includes("70-84g") && prompt.includes("POST-ENTRENAMIENTO")
})

// Test 12: Post-workout protein (0.25-0.4g/kg = 17-28g for 70kg)
testGuideline("Post-workout protein (0.25-0.4g/kg = 17-28g for 70kg) - CRITICAL", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("0.25-0.4g/kg") && prompt.includes("17-28g") && prompt.includes("CRÍTICO")
})

// Test 13: Post-workout hydration (150% of weight lost)
testGuideline("Post-workout hydration (150% of weight lost in 4-6 hours)", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("150% del peso perdido") && prompt.includes("4-6 horas")
})

// Test 14: Contextual adjustments for altitude
testGuideline("Altitude adjustment (>2000m: +10-15% carbs)", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("Altitud > 2000m") && prompt.includes("+10-15%")
})

// Test 15: Contextual adjustments for temperature
testGuideline("Temperature adjustments (>25°C: +10-20% hydration, <10°C: -20% hydration)", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return (
    prompt.includes("Temperatura > 25°C") &&
    prompt.includes("+10-20% hidratación") &&
    prompt.includes("< 10°C") &&
    prompt.includes("-20% hidratación")
  )
})

// Test 16: Contextual adjustments for humidity
testGuideline("Humidity adjustment (>70%: +10% hydration)", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("Humedad > 70%") && prompt.includes("+10% hidratación")
})

// Test 17: Caffeine guidelines (3-6mg/kg, intermediate+ only)
testGuideline("Caffeine guidelines (3-6mg/kg = 210-420mg for 70kg, intermediate+ only)", () => {
  const context = createContext({ experience_level: "intermediate" })
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("3-6mg/kg") && prompt.includes("210-420mg") && prompt.includes("intermediate")
})

// Test 18: Final validation rules
testGuideline("Final validation rules (kcal calculation, max sodium, max carbs)", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return (
    prompt.includes("Total kcal") &&
    prompt.includes("carbs*4") &&
    prompt.includes("proteína*4") &&
    prompt.includes("grasas*9") &&
    prompt.includes("1000mg/hora") &&
    prompt.includes("120g/hora")
  )
})

// Test 19: Female athlete adjustments
testGuideline("Female athlete adjustments (-5-10% kcal, menstrual cycle consideration)", () => {
  const context = createContext({ sex: "female" })
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("Sexo femenino") && prompt.includes("-5-10%") && prompt.includes("ciclo menstrual")
})

// Test 20: GI sensitivity adjustments
testGuideline("GI sensitivity adjustments (HIGH: -25% fats, low FODMAP options)", () => {
  const context = createContext({ gi_sensitivity: "high" })
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("GI sensitivity HIGH") && prompt.includes("-25%") && prompt.includes("FODMAP")
})

// Test 21: Prompt includes JSON validation
testGuideline("Prompt includes JSON validation instruction", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("JSON válido") && prompt.includes("parseable")
})

// Test 22: Consumption interval for optimal absorption
testGuideline("Consumption interval guidelines (15-20 min for optimal absorption)", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("15-20 min") && prompt.includes("absorción óptima")
})

// Print results
console.log("\n" + "=".repeat(81))
console.log(`\n📊 RESULTS: ${results.passed} passed, ${results.failed} failed (${results.tests.length} total)\n`)

if (results.failed === 0) {
  console.log("✅ ALL GUIDELINES VALIDATED SUCCESSFULLY!")
  console.log("\nThe nutrition generation prompt correctly implements:")
  console.log("  • ACSM/ISSN/IOC 2023 standards")
  console.log("  • Duration-based carbohydrate recommendations")
  console.log("  • Sweat-rate matched hydration")
  console.log("  • Gender-specific adjustments")
  console.log("  • Environmental factor compensation")
  console.log("  • GI sensitivity modifications")
  console.log("  • Contextual macro calculations")
  process.exit(0)
} else {
  console.log(`❌ ${results.failed} GUIDELINES FAILED VALIDATION\n`)
  results.tests.filter(t => !t.passed).forEach(t => console.log(`   • ${t.name}`))
  process.exit(1)
}
