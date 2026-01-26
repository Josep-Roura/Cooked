"use client"

type GeneratePlanResult = {
  ok: boolean
  usedFallback?: boolean
  start?: string
  end?: string
  days?: unknown[]
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
    credentials: "include",
    body: JSON.stringify({ start: date, end: date, force }),
  })

  const data = (await response.json().catch(() => ({}))) as GeneratePlanResult

  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? "AI plan generation failed")
  }

  return { usedFallback: data.usedFallback ?? false, days: data.days ?? [] }
}
