import "server-only"

import { systemPrompt } from "@/lib/ai/prompt"
import { editResponseSchema, weekPlanSchema, type EditResponse, type WeekPlan } from "@/lib/ai/schemas"

const DEFAULT_MODEL = "gpt-4o-mini"
const OPENAI_URL = "https://api.openai.com/v1/chat/completions"
const TIMEOUT_MS = 60000
const MAX_RETRIES = 2

type GeneratePlanInput = {
  start: string
  end: string
  profile: Record<string, unknown>
  workouts: Record<string, unknown>[]
  currentPlan?: WeekPlan | null
}

type EditPlanInput = GeneratePlanInput & {
  message: string
}

type JsonSchemaParser<T> = {
  parse: (input: unknown) => T
}

function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured")
  }
  return apiKey
}

async function callCookedAI<T>({
  model,
  userPayload,
  schema,
}: {
  model: string
  userPayload: Record<string, unknown>
  schema: JsonSchemaParser<T>
}): Promise<T> {
  const apiKey = getApiKey()
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const response = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: JSON.stringify(userPayload) },
          ],
        }),
        signal: controller.signal,
      })

      const data = await response.json().catch(() => null)
      if (!response.ok || !data) {
        const message = data?.error?.message ?? "OpenAI request failed"
        throw new Error(message)
      }

      const content = data.choices?.[0]?.message?.content ?? ""
      const parsed = JSON.parse(content)
      return schema.parse(parsed)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Failed to parse AI response")
      if (attempt >= MAX_RETRIES) {
        throw lastError
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  throw lastError ?? new Error("Failed to parse AI response")
}

export async function generateWeeklyPlan(input: GeneratePlanInput): Promise<WeekPlan> {
  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL
  const payload = {
    task: "generate_week_plan",
    start: input.start,
    end: input.end,
    profile: input.profile,
    workouts: input.workouts,
    currentPlan: input.currentPlan ?? null,
  }
  return callCookedAI({ model, userPayload: payload, schema: weekPlanSchema })
}

export async function applyPlanEdits(input: EditPlanInput): Promise<EditResponse> {
  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL
  const payload = {
    task: "edit_week_plan",
    start: input.start,
    end: input.end,
    profile: input.profile,
    workouts: input.workouts,
    currentPlan: input.currentPlan ?? null,
    message: input.message,
  }
  return callCookedAI({ model, userPayload: payload, schema: editResponseSchema })
}
