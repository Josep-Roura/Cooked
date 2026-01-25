"use client"

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
  const response = await fetch("/api/ai/plan/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, force }),
  })

  const data = (await response.json().catch(() => ({}))) as GeneratePlanResult

  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? "AI plan generation failed")
  }

  return { usedFallback: false, plan: data.plan }
}
