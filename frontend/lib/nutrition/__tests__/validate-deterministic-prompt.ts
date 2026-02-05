import { generateSportsNutritionistPrompt, type NutritionistContext } from "../ai-nutritionist-prompt"

/**
 * Validation script for the new deterministic nutrition prompt (v2)
 * Verifies that the prompt includes all required calculation rules
 */

// Helper to create test context
function createContext(overrides: Partial<NutritionistContext>): NutritionistContext {
  const defaults: NutritionistContext = {
    athleteName: "Test Athlete",
    weight_kg: 70,
    age: 30,
    sex: "male",
    experience_level: "intermediate",
    sweat_rate: "medium",
    gi_sensitivity: "low",
    caffeine_use: "some",
    primary_goal: "endurance",
    workoutType: "cycling",
    durationMinutes: 90,
    intensity: "moderate",
    description: "Typical workout",
    country: "USA",
    availableProducts: "",
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

console.log("\n📋 DETERMINISTIC NUTRITION PROMPT VALIDATION (v2)\n")
console.log("=" + "=".repeat(80) + "\n")

// Test 1: Core structure - JSON format requirement
testGuideline("Prompt specifies ONLY JSON output", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("ÚNICAMENTE JSON") && prompt.includes("sin texto extra")
})

// Test 2: Core structure - No extra keys
testGuideline("Prompt specifies strict schema (no extra keys)", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("EXACTAMENTE esta estructura") && prompt.includes("sin claves extra")
})

// Test 3: Athlete profile inclusion
testGuideline("Prompt includes complete athlete profile", () => {
  const context = createContext({
    athleteName: "John Doe",
    weight_kg: 75,
    age: 28,
    sex: "male",
    experience_level: "advanced",
  })
  const prompt = generateSportsNutritionistPrompt(context)
  return (
    prompt.includes("John Doe") &&
    prompt.includes("75 kg") &&
    prompt.includes("28 años") &&
    prompt.includes("Masculino") &&
    prompt.includes("avanzado")
  )
})

// Test 4: Workout details
testGuideline("Prompt includes workout parameters", () => {
  const context = createContext({
    workoutType: "triathlon",
    durationMinutes: 180,
    intensity: "high",
    distance_km: 51.5,
    elevation_gain_m: 800,
  })
  const prompt = generateSportsNutritionistPrompt(context)
  return (
    prompt.includes("triathlon") &&
    prompt.includes("180 min") &&
    prompt.includes("alta") &&
    prompt.includes("51.5 km") &&
    prompt.includes("800 m")
  )
})

// Test 5: PRE-WORKOUT - Duration <60 min carbs (0.5 g/kg)
testGuideline("PRE: <60 min duration = 0.5 g/kg carbs rule", () => {
  const context = createContext({ durationMinutes: 45 })
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("0.5 g/kg") && prompt.includes("durationMinutes < 60")
})

// Test 6: PRE-WORKOUT - Duration 60-90 min carbs (1.0 g/kg)
testGuideline("PRE: 60-90 min duration = 1.0 g/kg carbs rule", () => {
  const context = createContext({ durationMinutes: 75 })
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("1.0 g/kg") && prompt.includes("60 ≤ durationMinutes ≤ 90")
})

// Test 7: PRE-WORKOUT - Duration >90 min carbs (1.5-2.0 g/kg)
testGuideline("PRE: >90 min duration = 1.5-2.0 g/kg carbs rule", () => {
  const context = createContext({ durationMinutes: 120 })
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("1.5 g/kg") && prompt.includes("2.0 g/kg") && prompt.includes("durationMinutes > 90")
})

// Test 8: PRE-WORKOUT - Protein (0.3 g/kg)
testGuideline("PRE: Protein = 0.3 g/kg rule", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("0.3 g/kg") && prompt.includes("Proteína pre")
})

// Test 9: PRE-WORKOUT - High GI sensitivity fat limit
testGuideline("PRE: High GI = fat ≤10g, fiber ≤3g", () => {
  const context = createContext({ gi_sensitivity: "high" })
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("<= 10 g") && prompt.includes("<= 3 g") && prompt.includes("GI sensitivity=high")
})

// Test 10: PRE-WORKOUT - Medium GI sensitivity fat/fiber
testGuideline("PRE: Medium GI = fat ≤15g, fiber ≤5g", () => {
  const context = createContext({ gi_sensitivity: "medium" })
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("<= 15 g") && prompt.includes("<= 5 g") && prompt.includes("GI sensitivity=medium")
})

// Test 11: PRE-WORKOUT - Low GI sensitivity fat/fiber
testGuideline("PRE: Low GI = fat ≤20g, fiber ≤8g", () => {
  const context = createContext({ gi_sensitivity: "low" })
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("<= 20 g") && prompt.includes("<= 8 g") && prompt.includes("GI sensitivity=low")
})

// Test 12: PRE-WORKOUT - Hydration by sweat rate
testGuideline("PRE: Hydration by sweat_rate (400/500/600 ml)", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("400 ml") && prompt.includes("500 ml") && prompt.includes("600 ml")
})

// Test 13: PRE-WORKOUT - Caffeine by use profile
testGuideline("PRE: Caffeine (none=0, some=2mg/kg, high=3mg/kg)", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return (
    prompt.includes('caffeine_use="none"') &&
    prompt.includes("2 mg/kg") &&
    prompt.includes("3 mg/kg") &&
    prompt.includes("máx 200 mg") &&
    prompt.includes("máx 300 mg")
  )
})

// Test 14: DURING - <60 min carbs (0 or 15 g/h for very_high)
testGuideline("DURING: <60 min = 0 g/h carbs (or 15 for very_high)", () => {
  const context = createContext({ durationMinutes: 45 })
  const prompt = generateSportsNutritionistPrompt(context)
  return (
    prompt.includes("durationMinutes < 60") &&
    prompt.includes("carbs/h = 0 g") &&
    prompt.includes("15 g/h")
  )
})

// Test 15: DURING - 60-90 min carbs by intensity
testGuideline("DURING: 60-90 min carbs = 30/45/60 g/h by intensity", () => {
  const context = createContext({ durationMinutes: 75 })
  const prompt = generateSportsNutritionistPrompt(context)
  return (
    prompt.includes("60–90") &&
    prompt.includes("moderate: 30 g/h") &&
    prompt.includes("high: 45 g/h") &&
    prompt.includes("very_high: 60 g/h")
  )
})

// Test 16: DURING - >90 min carbs by intensity
testGuideline("DURING: >90 min carbs = 60/75/90 g/h by intensity", () => {
  const context = createContext({ durationMinutes: 120 })
  const prompt = generateSportsNutritionistPrompt(context)
  return (
    prompt.includes(">90") &&
    prompt.includes("moderate: 60 g/h") &&
    prompt.includes("high: 75 g/h") &&
    prompt.includes("very_high: 90 g/h")
  )
})

// Test 17: DURING - CHO/h max limit (90 g/h standard)
testGuideline("DURING: CHO/h maximum = 90 g/h", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("CHO/h máximo 90")
})

// Test 18: DURING - High GI sensitivity CHO reduction
testGuideline("DURING: High GI = reduce CHO/h 15%", () => {
  const context = createContext({ gi_sensitivity: "high" })
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("GI sensitivity=high") && prompt.includes("15%")
})

// Test 19: DURING - Hydration by sweat rate
testGuideline("DURING: Hydration = 500/750/950 ml/h by sweat_rate", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return (
    prompt.includes("500 ml/h") &&
    prompt.includes("750 ml/h") &&
    prompt.includes("950 ml/h")
  )
})

// Test 20: DURING - Hydration very_high intensity adjustment
testGuideline("DURING: Very high intensity = +100 ml/h hydration (cap 1100)", () => {
  const context = createContext({ intensity: "very_high" })
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("+100 ml/h") && prompt.includes("cap 1100 ml/h")
})

// Test 21: DURING - Sodium by sweat rate
testGuideline("DURING: Sodium = 300/500/700 mg/h by sweat_rate", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return (
    prompt.includes("300 mg/h") &&
    prompt.includes("500 mg/h") &&
    prompt.includes("700 mg/h") &&
    prompt.includes("Límite: 1000 mg/h")
  )
})

// Test 22: DURING - Interval by GI sensitivity
testGuideline("DURING: Interval = 15 min (high GI) or 20 min (medium/low)", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return (
    prompt.includes("15 min") &&
    prompt.includes("GI sensitivity=high") &&
    prompt.includes("20 min") &&
    prompt.includes("GI sensitivity=medium/low")
  )
})

// Test 23: DURING - Caffeine rules
testGuideline("DURING: Caffeine >120 min = 50-100 mg (if use enabled)", () => {
  const context = createContext({ durationMinutes: 180 })
  const prompt = generateSportsNutritionistPrompt(context)
  return (
    prompt.includes("durationMinutes > 120") &&
    prompt.includes("50–100 mg") &&
    prompt.includes("400 mg/día")
  )
})

// Test 24: POST-WORKOUT - Carbs ≤90 min (1.0 g/kg)
testGuideline("POST: ≤90 min = 1.0 g/kg carbs", () => {
  const context = createContext({ durationMinutes: 60 })
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("1.0 g/kg") && prompt.includes("durationMinutes <= 90")
})

// Test 25: POST-WORKOUT - Carbs >90 min (1.2 g/kg)
testGuideline("POST: >90 min or high intensity = 1.2 g/kg carbs", () => {
  const context = createContext({ durationMinutes: 120, intensity: "high" })
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("1.2 g/kg")
})

// Test 26: POST-WORKOUT - Protein (0.3 g/kg)
testGuideline("POST: Protein = 0.3 g/kg", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("Proteína post") && prompt.includes("0.3 g/kg")
})

// Test 27: POST-WORKOUT - Fat moderate (10-20 g, or 10 if high GI)
testGuideline("POST: Fat = 10-20 g (10 g if high GI sensitivity)", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("10–20 g") && prompt.includes("GI sensitivity=high: 10 g")
})

// Test 28: POST-WORKOUT - Hydration by sweat rate
testGuideline("POST: Hydration = 600/800/1000 ml by sweat_rate", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("600 ml") && prompt.includes("800 ml") && prompt.includes("1000 ml")
})

// Test 29: POST-WORKOUT - Sodium by sweat rate
testGuideline("POST: Sodium = 300/500/700 mg by sweat_rate", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("300 mg") && prompt.includes("500 mg") && prompt.includes("700 mg")
})

// Test 30: Real products requirement
testGuideline("Prompt emphasizes REAL, executable products", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return (
    prompt.includes("REALISTAS") &&
    prompt.includes("consumibles") &&
    prompt.includes("productos específicos")
  )
})

// Test 31: JSON output schema - pre_entrenamiento structure
testGuideline("JSON schema includes pre_entrenamiento with proper structure", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return (
    prompt.includes('"pre_entrenamiento"') &&
    prompt.includes('"timing_minutos"') &&
    prompt.includes('"descripcion_timing"') &&
    prompt.includes('"recomendaciones"') &&
    prompt.includes('"productos_especificos"') &&
    prompt.includes('"rationale"')
  )
})

// Test 32: JSON output schema - durante_entrenamiento structure
testGuideline("JSON schema includes durante_entrenamiento with proper structure", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return (
    prompt.includes('"durante_entrenamiento"') &&
    prompt.includes('"estrategia"') &&
    prompt.includes('"carbohidratos_por_hora_g"') &&
    prompt.includes('"hidratacion_por_hora_ml"') &&
    prompt.includes('"sodio_por_hora_mg"') &&
    prompt.includes('"intervalo_minutos"') &&
    prompt.includes('"productos_intervalo"')
  )
})

// Test 33: JSON output schema - post_entrenamiento structure
testGuideline("JSON schema includes post_entrenamiento with proper structure", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return (
    prompt.includes('"post_entrenamiento"') &&
    prompt.includes('"ventana_recuperacion"') &&
    prompt.includes('"timing_minutos"')
  )
})

// Test 34: JSON output schema - gasto_energetico calculation
testGuideline("JSON schema includes gasto_energetico with kcal calculation", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return (
    prompt.includes('"gasto_energetico"') &&
    prompt.includes('"kcal_totales"') &&
    prompt.includes('"calculo_metodo"')
  )
})

// Test 35: JSON output schema - notas_personalizadas
testGuideline("JSON schema includes notas_personalizadas for context", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return (
    prompt.includes('"notas_personalizadas"') &&
    prompt.includes('"consideraciones_perfil"') &&
    prompt.includes('"ajustes_segun_clima"') &&
    prompt.includes('"seguimiento"') &&
    prompt.includes('"tips_profesionales"')
  )
})

// Test 36: Validation rules - coherence check
testGuideline("Prompt includes validation rules (coherence check)", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return (
    prompt.includes("VALIDACIÓN FINAL") &&
    prompt.includes("números deben ser coherentes") &&
    prompt.includes("humanos")
  )
})

// Test 37: Validation rules - interval timing alignment
testGuideline("Prompt validates interval timing aligns with carb targets", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("La estrategia") && prompt.includes("intervalo_minutos")
})

// Test 38: Products constraint - no invention of brands
testGuideline("Prompt forbids inventing non-existent products", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("No inventes") && prompt.includes("productos raros") && prompt.includes("inaccesibles")
})

// Test 39: Practical execution emphasis
testGuideline("Prompt emphasizes 100% executable plans", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("100% ejecutable") && prompt.includes("números precisos") && prompt.includes("no rangos")
})

// Test 40: Scientific basis reference
testGuideline("Prompt references ACSM/IOC/ISSN standards", () => {
  const context = createContext({})
  const prompt = generateSportsNutritionistPrompt(context)
  return prompt.includes("ACSM/IOC/ISSN") && prompt.includes("consenso científico")
})

// Print results
console.log("\n" + "=".repeat(81))
console.log(`\n📊 RESULTS: ${results.passed} passed, ${results.failed} failed (${results.tests.length} total)\n`)

if (results.failed === 0) {
  console.log("✅ ALL DETERMINISTIC PROMPT VALIDATIONS PASSED!")
  console.log("\nThe v2 prompt correctly implements:")
  console.log("  • Deterministic macro calculations (no ranges)")
  console.log("  • Duration & intensity-based rules")
  console.log("  • Sweat-rate matched hydration strategy")
  console.log("  • GI sensitivity adaptations")
  console.log("  • Strict JSON schema enforcement")
  console.log("  • Real, executable product recommendations")
  console.log("  • Scientific basis (ACSM/IOC/ISSN)")
  process.exit(0)
} else {
  console.log(`❌ ${results.failed} VALIDATIONS FAILED\n`)
  results.tests.filter(t => !t.passed).forEach(t => console.log(`   • ${t.name}`))
  process.exit(1)
}
