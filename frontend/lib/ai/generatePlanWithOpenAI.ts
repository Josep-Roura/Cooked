"use client"

import { ensureNutritionPlanRange } from "@/lib/nutrition/ensure"

type GeneratePlanResult = {
  ok: boolean
  plan?: unknown
  error?: string
}

export async function generatePlanWithOpenAI({
  date,
  force = false,
}: {
  date: string
  force?: boolean
}) {
  try {
    const response = await fetch("/api/ai/generate-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, force }),
    })

    const data = (await response.json().catch(() => ({}))) as GeneratePlanResult

    if (!response.ok || !data.ok) {
      throw new Error(data.error ?? "AI plan generation failed")
    }

    return { usedFallback: false, plan: data.plan }
  } catch (error) {
    console.warn("AI plan generation failed, falling back to deterministic plan", error)
    await ensureNutritionPlanRange({ start: date, end: date, force })
    return { usedFallback: true }
  }
}
