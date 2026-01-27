"use client"

import { useEffect, useMemo, useRef } from "react"
import { format } from "date-fns"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/components/ui/use-toast"
import { getDateRange } from "@/lib/db/queries"
import type { DateRangeOption } from "@/lib/db/types"

const STORAGE_PREFIX = "cooked.nutrition.ensure"
const ENSURE_COOLDOWN_MS = 10 * 60 * 1000

function getStorageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`
}

function buildRangeKey(start: string, end: string) {
  return `${start}:${end}`
}

function readEnsureCache(userId: string): Record<string, number> {
  if (typeof window === "undefined") return {}
  const raw = window.localStorage.getItem(getStorageKey(userId))
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, number>
    if (parsed && typeof parsed === "object") {
      return parsed
    }
  } catch {
    return {}
  }
  return {}
}

function writeEnsureCache(userId: string, cache: Record<string, number>) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(cache))
}

export function readEnsuredRange(userId: string) {
  const cache = readEnsureCache(userId)
  const entries = Object.entries(cache)
  if (entries.length === 0) return null
  entries.sort((a, b) => b[1] - a[1])
  return entries[0][0] ?? null
}

export function writeEnsuredRange(userId: string, start: string, end: string) {
  const cache = readEnsureCache(userId)
  cache[buildRangeKey(start, end)] = Date.now()
  writeEnsureCache(userId, cache)
}

function shouldEnsureRange(userId: string, rangeKey: string) {
  const cache = readEnsureCache(userId)
  const lastEnsured = cache[rangeKey]
  if (!lastEnsured) return true
  return Date.now() - lastEnsured > ENSURE_COOLDOWN_MS
}

type GeneratePlanResult = {
  ok: boolean
  start?: string
  end?: string
  usedFallback?: boolean
  error?: { code?: string; message?: string; details?: string }
  details?: string
}

function extractErrorMessage(payload: GeneratePlanResult | Record<string, any>) {
  if (!payload) return "Request failed"
  if (typeof payload.error === "string") return payload.error
  if (payload.error && typeof payload.error === "object") {
    return payload.error.message ?? payload.error.code ?? "Request failed"
  }
  if (payload.details && typeof payload.details === "string") return payload.details
  return "Request failed"
}

export async function ensureNutritionPlanRange({
  start,
  end,
  force = false,
}: {
  start: string
  end: string
  force?: boolean
}) {
  const response = await fetch(`/api/ai/plan/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start, end, force }),
  })
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as GeneratePlanResult
    throw new Error(extractErrorMessage(errorBody) ?? "Failed to ensure nutrition plan")
  }
  return (await response.json()) as GeneratePlanResult
}

export async function ensureDailyPlan(date: string, force = false) {
  return ensureNutritionPlanRange({ start: date, end: date, force })
}

export function useEnsureNutritionPlan({
  userId,
  range,
  enabled = true,
  debounceMs = 800,
}: {
  userId: string | null | undefined
  range: DateRangeOption
  enabled?: boolean
  debounceMs?: number
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const lastEnsuredRef = useRef<string | null>(null)

  const rangeKey = useMemo(() => {
    if (!userId) return null
    const now = new Date()
    const { start, end } = getDateRange(range, now)
    const startKey = format(start, "yyyy-MM-dd")
    const endKey = format(end, "yyyy-MM-dd")
    return { key: buildRangeKey(startKey, endKey), start: startKey, end: endKey }
  }, [range, userId])

  useEffect(() => {
    if (!userId || !enabled || !rangeKey) return
    if (lastEnsuredRef.current === rangeKey.key) return

    if (!shouldEnsureRange(userId, rangeKey.key)) {
      lastEnsuredRef.current = rangeKey.key
      return
    }

    const timeoutId = window.setTimeout(() => {
      ensureNutritionPlanRange({ start: rangeKey.start, end: rangeKey.end })
        .then(() => {
          lastEnsuredRef.current = rangeKey.key
          writeEnsuredRange(userId, rangeKey.start, rangeKey.end)
          queryClient.invalidateQueries({ queryKey: ["db", "nutrition-summary", userId] })
          queryClient.invalidateQueries({ queryKey: ["db", "nutrition-day", userId] })
          queryClient.invalidateQueries({ queryKey: ["db", "calendar-events", userId] })
          queryClient.invalidateQueries({ queryKey: ["db", "dashboard-overview", userId] })
        })
        .catch((error) => {
          console.error("Failed to ensure nutrition plan", error)
          toast({
            title: "Nutrition update failed",
            description: error instanceof Error ? error.message : "Unable to update nutrition plan.",
            variant: "destructive",
          })
        })
    }, debounceMs)

    return () => window.clearTimeout(timeoutId)
  }, [debounceMs, enabled, queryClient, rangeKey, toast, userId])
}

export function useEnsureNutritionPlanRange({
  userId,
  start,
  end,
  enabled = true,
  debounceMs = 800,
}: {
  userId: string | null | undefined
  start: string
  end: string
  enabled?: boolean
  debounceMs?: number
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const lastEnsuredRef = useRef<string | null>(null)
  const rangeKey = useMemo(() => buildRangeKey(start, end), [end, start])

  useEffect(() => {
    if (!userId || !enabled || !start || !end) return
    if (lastEnsuredRef.current === rangeKey) return
    if (!shouldEnsureRange(userId, rangeKey)) {
      lastEnsuredRef.current = rangeKey
      return
    }

    const timeoutId = window.setTimeout(() => {
      ensureNutritionPlanRange({ start, end })
        .then(() => {
          lastEnsuredRef.current = rangeKey
          writeEnsuredRange(userId, start, end)
          queryClient.invalidateQueries({ queryKey: ["db", "nutrition-summary", userId] })
          queryClient.invalidateQueries({ queryKey: ["db", "nutrition-day", userId] })
          queryClient.invalidateQueries({ queryKey: ["db", "calendar-events", userId] })
          queryClient.invalidateQueries({ queryKey: ["db", "dashboard-overview", userId] })
          queryClient.invalidateQueries({ queryKey: ["db", "nutrition-week", userId] })
          queryClient.invalidateQueries({ queryKey: ["db", "meal-plan-day", userId] })
          queryClient.invalidateQueries({ queryKey: ["db", "macros-day", userId] })
        })
        .catch((error) => {
          console.error("Failed to ensure nutrition plan", error)
          toast({
            title: "Nutrition update failed",
            description: error instanceof Error ? error.message : "Unable to update nutrition plan.",
            variant: "destructive",
          })
        })
    }, debounceMs)

    return () => window.clearTimeout(timeoutId)
  }, [debounceMs, enabled, end, queryClient, rangeKey, start, toast, userId])
}
