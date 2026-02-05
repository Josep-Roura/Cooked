import { describe, test } from "node:test"
import { generateSportsNutritionistPrompt, type NutritionistContext } from "../ai-nutritionist-prompt"

/**
 * Test suite to validate macro calculation guidelines
 * Ensures ACSM/ISSN/IOC 2023 standards are properly integrated
 */

describe("Macro Calculation Guidelines (ACSM/ISSN/IOC 2023)", () => {
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

  // Test 1: Pre-workout carbs for <60 min sessions
  test("Pre-workout carbs for <60 min sessions (1-4g/kg, use 70-140g)", () => {
    const context = createContext({ durationMinutes: 45, intensity: "moderate" })
    const prompt = generateSportsNutritionistPrompt(context)

    // Verify prompt contains carb guidelines
    expect(prompt).toContain("1-4g carbs/kg")
    expect(prompt).toContain("70-140g") // For 70kg athlete, low range
    console.log("✓ Pre-workout <60 min carb guidelines present")
  })

  // Test 2: Pre-workout carbs for 60-90 min sessions
  test("Pre-workout carbs for 60-90 min sessions (1-4g/kg)", () => {
    const context = createContext({ durationMinutes: 75 })
    const prompt = generateSportsNutritionistPrompt(context)

    expect(prompt).toContain("1-4g carbs/kg")
    expect(prompt).toContain("70-140g")
    console.log("✓ Pre-workout 60-90 min carb guidelines present")
  })

  // Test 3: Pre-workout carbs for >90 min sessions
  test("Pre-workout carbs for >90 min sessions (2-4g/kg, use 140-280g)", () => {
    const context = createContext({ durationMinutes: 120 })
    const prompt = generateSportsNutritionistPrompt(context)

    expect(prompt).toContain("2-4g carbs/kg")
    expect(prompt).toContain("140-280g") // For 70kg athlete, high range
    console.log("✓ Pre-workout >90 min carb guidelines present")
  })

  // Test 4: Pre-workout protein (0.25-0.4g/kg)
  test("Pre-workout protein (0.25-0.4g/kg = 17-28g for 70kg)", () => {
    const context = createContext({})
    const prompt = generateSportsNutritionistPrompt(context)

    expect(prompt).toContain("0.25-0.4g/kg")
    expect(prompt).toContain("17-28g")
    expect(prompt).toContain("saciedad") // Spanish: satiety
    console.log("✓ Pre-workout protein guidelines present")
  })

  // Test 5: Pre-workout fats limit (≤1g/kg)
  test("Pre-workout fat limit (≤1g/kg = max 70g for 70kg)", () => {
    const context = createContext({})
    const prompt = generateSportsNutritionistPrompt(context)

    expect(prompt).toContain("≤1g/kg")
    expect(prompt).toContain("70g")
    expect(prompt).toContain("GI") // Gastrointestinal
    console.log("✓ Pre-workout fat limit guidelines present")
  })

  // Test 6: During-workout <60 min (water only)
  test("During-workout <60 min (water + electrolytes, 0g carbs)", () => {
    const context = createContext({ durationMinutes: 45 })
    const prompt = generateSportsNutritionistPrompt(context)

    expect(prompt).toContain("< 60 min")
    expect(prompt).toContain("150-250ml cada 15-20 min")
    expect(prompt).toContain("0g") // No carbs for <60min
    console.log("✓ During-workout <60 min guidelines present")
  })

  // Test 7: During-workout 60-90 min (30-60g carbs/hour)
  test("During-workout 60-90 min (30-60g carbs/hour)", () => {
    const context = createContext({ durationMinutes: 75 })
    const prompt = generateSportsNutritionistPrompt(context)

    expect(prompt).toContain("60-90 min")
    expect(prompt).toContain("30-60g/hora")
    expect(prompt).toContain("500-750ml/hora")
    console.log("✓ During-workout 60-90 min guidelines present")
  })

  // Test 8: During-workout >90 min (60-90g carbs/hour, multiple sources)
  test("During-workout >90 min (60-90g carbs/hour, up to 120g with multiple sources)", () => {
    const context = createContext({ durationMinutes: 120 })
    const prompt = generateSportsNutritionistPrompt(context)

    expect(prompt).toContain("> 90 min")
    expect(prompt).toContain("60-90g/hora")
    expect(prompt).toContain("multiple carb sources")
    expect(prompt).toContain("120g/h")
    console.log("✓ During-workout >90 min guidelines present")
  })

  // Test 9: During-workout hydration by sweat_rate
  test("During-workout hydration by sweat_rate (Low: 400-500, Medium: 600-800, High: 800-1000)", () => {
    const context = createContext({})
    const prompt = generateSportsNutritionistPrompt(context)

    expect(prompt).toContain("400-500ml/hora")
    expect(prompt).toContain("600-800ml/hora")
    expect(prompt).toContain("800-1000ml/hora")
    console.log("✓ During-workout sweat_rate hydration guidelines present")
  })

  // Test 10: During-workout sodium guidelines
  test("During-workout sodium (300-700mg/hour, max 1000mg/hour for hot climate)", () => {
    const context = createContext({})
    const prompt = generateSportsNutritionistPrompt(context)

    expect(prompt).toContain("300-700mg/hora")
    expect(prompt).toContain("1000mg/hora")
    console.log("✓ During-workout sodium guidelines present")
  })

  // Test 11: Post-workout carbs (1.0-1.2g/kg = 70-84g for 70kg)
  test("Post-workout carbs (1.0-1.2g/kg = 70-84g for 70kg)", () => {
    const context = createContext({})
    const prompt = generateSportsNutritionistPrompt(context)

    expect(prompt).toContain("1.0-1.2g/kg")
    expect(prompt).toContain("70-84g")
    expect(prompt).toContain("post-entrenamiento")
    console.log("✓ Post-workout carb guidelines present")
  })

  // Test 12: Post-workout protein (0.25-0.4g/kg = 17-28g for 70kg)
  test("Post-workout protein (0.25-0.4g/kg = 17-28g for 70kg) - CRITICAL for muscle synthesis", () => {
    const context = createContext({})
    const prompt = generateSportsNutritionistPrompt(context)

    expect(prompt).toContain("0.25-0.4g/kg")
    expect(prompt).toContain("17-28g")
    expect(prompt).toContain("CRÍTICO") // Spanish: CRITICAL
    console.log("✓ Post-workout protein guidelines present")
  })

  // Test 13: Post-workout hydration (150% of weight lost)
  test("Post-workout hydration (150% of weight lost in 4-6 hours)", () => {
    const context = createContext({})
    const prompt = generateSportsNutritionistPrompt(context)

    expect(prompt).toContain("150% del peso perdido")
    expect(prompt).toContain("4-6 horas")
    console.log("✓ Post-workout hydration guidelines present")
  })

  // Test 14: Contextual adjustments for altitude
  test("Altitude adjustment (>2000m: +10-15% carbs)", () => {
    const context = createContext({})
    const prompt = generateSportsNutritionistPrompt(context)

    expect(prompt).toContain("Altitud > 2000m")
    expect(prompt).toContain("+10-15% carbs")
    console.log("✓ Altitude adjustment guidelines present")
  })

  // Test 15: Contextual adjustments for temperature
  test("Temperature adjustments (>25°C: +10-20% hydration, <10°C: -20% hydration)", () => {
    const context = createContext({})
    const prompt = generateSportsNutritionistPrompt(context)

    expect(prompt).toContain("Temperatura > 25°C")
    expect(prompt).toContain("+10-20% hidratación")
    expect(prompt).toContain("< 10°C")
    expect(prompt).toContain("-20% hidratación")
    console.log("✓ Temperature adjustment guidelines present")
  })

  // Test 16: Contextual adjustments for humidity
  test("Humidity adjustment (>70%: +10% hydration)", () => {
    const context = createContext({})
    const prompt = generateSportsNutritionistPrompt(context)

    expect(prompt).toContain("Humedad > 70%")
    expect(prompt).toContain("+10% hidratación")
    console.log("✓ Humidity adjustment guidelines present")
  })

  // Test 17: Caffeine guidelines (3-6mg/kg, intermediate+ only)
  test("Caffeine guidelines (3-6mg/kg = 210-420mg for 70kg, intermediate+ only)", () => {
    const context = createContext({ experience_level: "intermediate" })
    const prompt = generateSportsNutritionistPrompt(context)

    expect(prompt).toContain("3-6mg/kg")
    expect(prompt).toContain("210-420mg")
    expect(prompt).toContain("experience_level >= intermediate")
    console.log("✓ Caffeine guidelines present")
  })

  // Test 18: Final validation rules
  test("Final validation rules (kcal = (carbs*4)+(protein*4)+(fats*9), sodium max, carbs max)", () => {
    const context = createContext({})
    const prompt = generateSportsNutritionistPrompt(context)

    expect(prompt).toContain("Total kcal")
    expect(prompt).toContain("carbs*4")
    expect(prompt).toContain("protein*4")
    expect(prompt).toContain("fats*9")
    expect(prompt).toContain("Sodio: máximo 1000mg/hora")
    expect(prompt).toContain("Carbs: máximo 120g/hora")
    console.log("✓ Final validation rules present")
  })

  // Test 19: Female athlete adjustments
  test("Female athlete adjustments (-5-10% kcal, menstrual cycle consideration)", () => {
    const context = createContext({ sex: "female" })
    const prompt = generateSportsNutritionistPrompt(context)

    expect(prompt).toContain("Sexo femenino")
    expect(prompt).toContain("-5-10%")
    expect(prompt).toContain("ciclo menstrual")
    console.log("✓ Female athlete adjustment guidelines present")
  })

  // Test 20: GI sensitivity adjustments
  test("GI sensitivity adjustments (HIGH: -25% fats, low FODMAP options)", () => {
    const context = createContext({ gi_sensitivity: "high" })
    const prompt = generateSportsNutritionistPrompt(context)

    expect(prompt).toContain("GI sensitivity HIGH")
    expect(prompt).toContain("-25% grasas")
    expect(prompt).toContain("FODMAP")
    console.log("✓ GI sensitivity adjustment guidelines present")
  })

  // Test 21: Prompt is valid JSON-compatible (contains JSON instruction)
  test("Prompt includes JSON validation instruction", () => {
    const context = createContext({})
    const prompt = generateSportsNutritionistPrompt(context)

    expect(prompt).toContain("JSON válido")
    expect(prompt).toContain("parseable")
    console.log("✓ JSON validation instruction present")
  })

  // Test 22: Consumption interval for optimal absorption
  test("Consumption interval guidelines (15-20 min for optimal absorption)", () => {
    const context = createContext({})
    const prompt = generateSportsNutritionistPrompt(context)

    expect(prompt).toContain("15-20 min")
    expect(prompt).toContain("absorción óptima")
    console.log("✓ Consumption interval guidelines present")
  })
})

// Helper function for assertions
function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✅ PASS: ${name}`)
  } catch (error) {
    console.error(`❌ FAIL: ${name}`)
    console.error(error)
    process.exit(1)
  }
}

function expect(value: any) {
  return {
    toContain(substring: string) {
      if (!String(value).includes(substring)) {
        throw new Error(`Expected "${value}" to contain "${substring}"`)
      }
    },
  }
}
