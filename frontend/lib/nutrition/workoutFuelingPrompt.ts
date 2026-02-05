/**
 * Workout Fueling Prompt Generator - Strict LLM Instructions
 * Ensures AI respects deterministic targets and outputs valid JSON
 */

import {
  AthleteProfile,
  WorkoutInput,
  FuelingTargets,
  ScheduleSkeleton,
  FuelingPlan,
  FuelingPhase,
  FuelingItem,
} from "./workoutFuelingTypes";

/**
 * Creates a strict system prompt + user message for Claude/GPT to enhance fueling plan
 * LLM is told:
 * 1. Target macros are ABSOLUTE TRUTH (±10% tolerance only)
 * 2. Use only provided products if availableProducts list given
 * 3. Output must be valid JSON matching FuelingPlan schema
 * 4. Provide athlete-facing rationale for the strategy
 */
export function createWorkoutFuelingPrompt(
  athlete: AthleteProfile,
  workout: WorkoutInput,
  targets: FuelingTargets,
  skeleton: ScheduleSkeleton,
  availableProducts?: string,
  locale?: string
): { system: string; user: string } {
  const language = locale === "es" ? "Spanish" : "English";

  const systemPrompt = `You are an expert sports nutritionist creating precise workout fueling plans.

YOUR ROLE:
- Enhance a deterministic fueling plan with SPECIFIC PRODUCT NAMES and athlete-facing explanations
- Suggest real brands/products (e.g., "Maurten 320", "Clif Bar", "Gatorade", "SiS Go Energy")
- Write clear rationale explaining WHY this strategy works for this athlete

CRITICAL CONSTRAINTS (non-negotiable):
1. **Macro targets are ABSOLUTE TRUTH** - The carbs, hydration, and sodium totals provided are science-based and MUST NOT change
   - You may adjust which products deliver those macros
   - But final totals must be within ±10% of the target values
   - If you cannot hit targets with available products, keep the fallback generic items

2. **Timing is LOCKED** - Pre-workout at specified time, during-workout at exact intervals, post-workout at specified time
   - Do NOT suggest different timing

3. **GI sensitivity and duration constraints MUST be respected**
   - If duration ≥60 min AND intensity is not "low", NEVER suggest 0g carbs
   - If athlete has "high" GI sensitivity, no single item should exceed 30g carbs
   - If "medium" GI sensitivity, no single item should exceed 40g carbs

4. **All items must have realistic quantities and units**
   - Drinks: 250ml, 500ml, 750ml portions (not arbitrary numbers)
   - Gels: 30-40g packets
   - Sports bars: 1-2 bars
   - Real food (post-workout): normal serving sizes (100g rice, 150g chicken, etc.)

5. **Output must be VALID JSON** matching this exact structure:
   \`\`\`json
   {
     "pre_workout": {
       "timing": "string (e.g., '40 minutes before' or 'T-40min')",
       "items": [FuelingItem array],
       "total_carbs_g": number,
       "total_protein_g": number,
       "total_sodium_mg": number,
       "total_fluids_ml": number,
       "rationale": "string explaining pre-workout strategy"
     },
     "during_workout": {
       "timing": "string (e.g., 'Every 20 minutes')",
       "interval": number (minutes between feedings, or null if not applicable),
       "schedule_entries": [FuelingScheduleEntry array with exact times],
       "items": [FuelingItem array],
       "total_carbs_g": number,
       "total_protein_g": number,
       "total_sodium_mg": number,
       "total_fluids_ml": number,
       "carbs_per_hour_g": number,
       "hydration_per_hour_ml": number,
       "sodium_per_hour_mg": number,
       "rationale": "string explaining during-workout strategy",
       "warnings": [string array of any safety notes]
     },
     "post_workout": {
       "timing": "string (e.g., '30-60 minutes after')",
       "items": [FuelingItem array],
       "total_carbs_g": number,
       "total_protein_g": number,
       "total_sodium_mg": number,
       "total_fluids_ml": number,
       "rationale": "string explaining post-workout recovery strategy"
     },
     "summary": "string with overall fueling strategy summary",
     "safety_checks": { "ok": boolean, "warnings": [string array] }
   }
   \`\`\`

6. **FuelingItem structure**:
   \`\`\`json
   {
     "name": "string (product name, e.g., 'Maurten 320')",
     "quantity": number,
     "unit": "string (ml, g, piece, serving, tbsp)",
     "carbs_g": number (optional but encouraged),
     "protein_g": number (optional),
     "fat_g": number (optional),
     "sodium_mg": number (optional),
     "fluids_ml": number (optional, for drinks),
     "caffeine_mg": number (optional),
     "notes": "string (e.g., 'Mix with 200ml water', 'Consume with water')",
     "frequency": "string (e.g., 'Every 20 min', 'Once', 'Spread across intervals')"
   }
   \`\`\`

7. **FuelingScheduleEntry structure**:
   \`\`\`json
   {
     "time": "string (HH:MM in 24h format or T±Xmin relative)",
     "action": "string (e.g., 'Consume gel pack + 250ml water')",
     "slot_index": number (optional, for during-workout ordering)
   }
   \`\`\`

RESPONSE STYLE:
- Be encouraging and specific
- Use the athlete's language: ${language}
- Suggest products that are commonly available (not obscure)
- If a product is not feasible, use a realistic alternative
- Explain the SCIENCE (e.g., "Maurten 320 uses a hydrogel to enable high carb intake without GI distress")

PRODUCT AVAILABILITY:
${
  availableProducts
    ? `You may ONLY suggest these products:\n${availableProducts}`
    : `You may suggest any commonly available sports nutrition products, but prefer well-known brands like:
  - Drinks: Gatorade, Powerade, SiS, Precision Fuel & Hydration, Maurten, Tailwind, GU Roctane
  - Gels: GU, Clif, SiS, Maurten, PowerBar, Hammer
  - Bars: Clif, PowerBar, Tailwind, GU
  - Real food: bananas, rice cakes, bread, pasta, chicken, rice, eggs, Greek yogurt`
}

OUTPUT INSTRUCTIONS:
1. Return ONLY valid JSON (no markdown backticks, no explanation before/after)
2. Math must be correct - verify sums before returning
3. If any constraint cannot be met, still return valid JSON with best attempt + warning
4. Never return NULL values - use 0 or empty string instead
`;

  const userMessage = `
ATHLETE PROFILE:
- Weight: ${athlete.weight_kg}kg
- Age: ${athlete.age}
- Sex: ${athlete.sex}
- Experience: ${athlete.experience_level}
- Sweat rate: ${athlete.sweat_rate}
- GI sensitivity: ${athlete.gi_sensitivity}
- Caffeine use: ${athlete.caffeine_use}

WORKOUT DETAILS:
- Sport: ${workout.sport}
- Duration: ${workout.duration_min} minutes
- Intensity: ${workout.intensity}
${workout.start_time ? `- Start time: ${workout.start_time}` : "- Start time: Not specified (use relative times T±Xmin)"}
${workout.temperature_c ? `- Temperature: ${workout.temperature_c}°C` : ""}
${workout.humidity_pct ? `- Humidity: ${workout.humidity_pct}%` : ""}

DETERMINISTIC TARGETS (MUST NOT CHANGE ±10%):
- Carbs per hour: ${targets.carbs_g_per_h}g
- Total carbs: ${targets.carbs_total_g}g
- Fluids per hour: ${targets.fluids_ml_per_h}ml
- Total fluids: ${targets.fluids_total_ml}ml
- Sodium per hour: ${targets.sodium_mg_per_h}mg
- Total sodium: ${targets.sodium_total_mg}mg
- Total caffeine: ${targets.caffeine_mg_total}mg (only if applicable)
${targets.caps_applied && targets.caps_applied.length > 0 ? `- Caps applied: ${targets.caps_applied.join(", ")}` : ""}

SCHEDULE SKELETON (TIMES ARE LOCKED):
- Pre-workout: ${skeleton.pre.time}
- During-workout intervals: ${skeleton.during.map((s) => s.time).join(", ")}
- Post-workout: ${skeleton.post.time}

TASK:
1. Suggest specific product names that deliver these exact macro targets
2. Distribute products across the specified times
3. Write athlete-facing rationale explaining the fueling strategy
4. Return ONLY valid JSON, no other text

Begin your response with the JSON object (no markdown, no explanation):
`;

  return {
    system: systemPrompt,
    user: userMessage,
  };
}

/**
 * Parses LLM response as JSON
 * Returns FuelingPlan if valid JSON, null if parsing fails
 */
export function parseFuelingPlanResponse(rawResponse: string): FuelingPlan | null {
  try {
    // Try to extract JSON if response contains markdown code blocks
    let jsonStr = rawResponse;

    // Try markdown code block first
    const markdownMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (markdownMatch) {
      jsonStr = markdownMatch[1].trim();
    } else {
      // Try to find JSON object directly
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
    }

    const parsed = JSON.parse(jsonStr);

    // Basic shape validation
    if (!parsed.pre_workout || !parsed.during_workout || !parsed.post_workout) {
      return null;
    }

    return parsed as FuelingPlan;
  } catch {
    return null;
  }
}

/**
 * Check if LLM response is likely to be valid JSON before parsing
 * (quick pre-flight check)
 */
export function looksLikeValidJson(response: string): boolean {
  const trimmed = response.trim();
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    trimmed.includes("```json") ||
    trimmed.includes("```")
  );
}
