import type { PlanInput, GeneratedPlan } from "./generatePlan";

const MODEL = "gpt-4o-mini";

function extractJsonBlock(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return text.slice(start, end + 1);
}

function normalizePlan(data: any, fallbackCategory: string): GeneratedPlan | null {
  if (!data || typeof data !== "object") return null;
  if (typeof data.title !== "string" || typeof data.full_day_plan !== "object") {
    return null;
  }

  const category = typeof data.category === "string" ? data.category : fallbackCategory;
  const plan = data.full_day_plan;

  const ensureSection = (sectionKey: string) => {
    const section = plan?.[sectionKey];
    if (!section || typeof section !== "object") return null;
    if (typeof section.timing !== "string" || typeof section.nutrition !== "string") {
      return null;
    }
    return section;
  };

  const requiredKeys = [
    "preWorkout",
    "intraOrImmediatePost",
    "firstMeal",
    "snack",
    "lunch",
    "dinner",
    "beforeSleep"
  ];

  for (const key of requiredKeys) {
    if (!ensureSection(key)) {
      return null;
    }
  }

  return {
    title: data.title,
    category,
    full_day_plan: {
      preWorkout: plan.preWorkout,
      intraOrImmediatePost: plan.intraOrImmediatePost,
      firstMeal: plan.firstMeal,
      snack: plan.snack,
      lunch: plan.lunch,
      dinner: plan.dinner,
      beforeSleep: plan.beforeSleep
    }
  };
}

export async function tryGeneratePlanWithOpenAI(
  input: PlanInput
): Promise<GeneratedPlan | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "Eres un nutricionista deportivo. Devuelves únicamente JSON válido sin texto adicional."
          },
          {
            role: "user",
            content: `Genera un plan nutricional completo para TODO el día para un atleta con:
- Tipo de entreno: ${input.workoutType}
- Duración: ${input.durationMin} minutos
- Objetivo: ${input.goal}
- Peso: ${input.weightKg} kg
- Preferencias: ${input.dietPrefs || "ninguna"}
- Notas: ${input.notes || "sin notas"}

Devuelve SOLO JSON con la forma exacta:
{
  "title": string,
  "category": string,
  "full_day_plan": {
    "preWorkout": { "timing": string, "nutrition": string, "supplements"?: string, "example"?: string },
    "intraOrImmediatePost": { "timing": string, "nutrition": string, "notes"?: string },
    "firstMeal": { "timing": string, "nutrition": string, "example"?: string },
    "snack": { "timing": string, "nutrition": string, "example"?: string },
    "lunch": { "timing": string, "nutrition": string, "example"?: string },
    "dinner": { "timing": string, "nutrition": string, "example"?: string },
    "beforeSleep": { "timing": string, "nutrition": string, "supplements"?: string, "example"?: string }
  }
}`
          }
        ]
      })
    });

    if (!response.ok) {
      console.error("OpenAI error", await response.text());
      return null;
    }

    const json = (await response.json()) as any;
    const content: string | undefined = json?.choices?.[0]?.message?.content;
    if (!content) {
      return null;
    }

    const jsonBlock = extractJsonBlock(content.trim());
    if (!jsonBlock) {
      return null;
    }

    const parsed = JSON.parse(jsonBlock);
    return normalizePlan(parsed, input.goal) ?? null;
  } catch (error) {
    console.error("OpenAI request failed", error);
    return null;
  }
}
