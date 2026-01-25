import "server-only"

import OpenAI from "openai"
import { systemPrompt } from "@/lib/ai/prompt"
import { editResponseSchema, weeklyPlanSchema, type EditResponse, type WeeklyPlan } from "@/lib/ai/schemas"

const DEFAULT_MODEL = "gpt-4o-mini"

type GenerateWeeklyPlanInput = {
  weekStart: string
  weekEnd: string
  profile: Record<string, unknown>
  workouts: Record<string, unknown>[]
}

type ApplyPlanEditsInput = {
  weekStart: string
  weekEnd: string
  profile: Record<string, unknown>
  workouts: Record<string, unknown>[]
  currentPlan: WeeklyPlan
  message: string
}

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured")
  }
  return new OpenAI({ apiKey })
}

async function requestWithSchema<T>({
  model,
  messages,
  schema,
}: {
  model: string
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  schema: { parse: (input: unknown) => T }
}): Promise<T> {
  const client = getClient()
  let lastError: Error | null = null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.2,
      response_format: { type: "json_object" },
    })

    const content = response.choices[0]?.message?.content ?? ""
    try {
      const parsed = JSON.parse(content)
      return schema.parse(parsed)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Failed to parse AI response")
      messages = [
        ...messages,
        { role: "assistant", content },
        {
          role: "user",
          content:
            "Your previous response did not match the required JSON schema. Return ONLY valid JSON that matches the schema.",
        },
      ]
    }
  }

  throw lastError ?? new Error("Failed to parse AI response")
}

export async function generateWeeklyPlan(input: GenerateWeeklyPlanInput): Promise<WeeklyPlan> {
  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: JSON.stringify({
        task: "generate_weekly_plan",
        week_start: input.weekStart,
        week_end: input.weekEnd,
        profile: input.profile,
        workouts: input.workouts,
      }),
    },
  ]

  return requestWithSchema({ model, messages, schema: weeklyPlanSchema })
}

export async function applyPlanEdits(input: ApplyPlanEditsInput): Promise<EditResponse> {
  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: JSON.stringify({
        task: "edit_weekly_plan",
        week_start: input.weekStart,
        week_end: input.weekEnd,
        profile: input.profile,
        workouts: input.workouts,
        current_plan: input.currentPlan,
        message: input.message,
      }),
    },
  ]

  return requestWithSchema({ model, messages, schema: editResponseSchema })
}
