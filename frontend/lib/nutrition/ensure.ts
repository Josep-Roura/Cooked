"use client"

import { useEffect, useMemo, useRef } from "react"
import { format } from "date-fns"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/components/ui/use-toast"
import { getDateRange } from "@/lib/db/queries"
import type { DateRangeOption } from "@/lib/db/types"

const STORAGE_PREFIX = "cooked.nutrition.ensure"

function getStorageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`
}

function buildRangeKey(start: string, end: string) {
  return `${start}:${end}`
}

export function readEnsuredRange(userId: string) {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(getStorageKey(userId))
}

export function writeEnsuredRange(userId: string, start: string, end: string) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(getStorageKey(userId), buildRangeKey(start, end))
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
  const params = new URLSearchParams({ start, end })
  if (force) {
    params.set("force", "true")
  }
  const response = await fetch(`/api/v1/nutrition/ensure?${params.toString()}`, { method: "POST" })
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody?.error ?? "Failed to ensure nutrition plan")
  }
  return response.json()
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

    const cached = readEnsuredRange(userId)
    if (cached === rangeKey.key) {
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
