import "server-only"

import type { EditResponse, WeekPlan } from "@/lib/ai/schemas"

const AI_DISABLED_MESSAGE = "OpenAI calls are handled exclusively by /api/ai/plan/generate"

type GeneratePlanInput = {
  start: string
  end: string
  profile: Record<string, unknown>
  workouts: Record<string, unknown>[]
  currentPlan?: WeekPlan | null
  requestId?: string
}

type EditPlanInput = GeneratePlanInput & {
  message: string
}

export async function generateWeeklyPlan(_input: GeneratePlanInput): Promise<WeekPlan> {
  throw new Error(AI_DISABLED_MESSAGE)
}

export async function applyPlanEdits(_input: EditPlanInput): Promise<EditResponse> {
  throw new Error(AI_DISABLED_MESSAGE)
}
