import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const MAX_RANGE_DAYS = 7

function parseDate(value: string) {
  if (!DATE_REGEX.test(value)) return null
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return Number.isNaN(date.getTime()) ? null : date
}

function buildDateRange(start: string, end: string) {
  const startDate = parseDate(start)
  const endDate = parseDate(end)
  if (!startDate || !endDate) return null
  if (start > end) return null
  const days = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  if (days > MAX_RANGE_DAYS) return null
  return { startDate, endDate, days }
}

function formatDate(date: Date) {
  return date.toISOString().split("T")[0]
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const start = searchParams.get("start") ?? ""
    const end = searchParams.get("end") ?? ""

    const range = buildDateRange(start, end)
    if (!range) {
      return NextResponse.json({ error: "Invalid date range." }, { status: 400 })
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated", details: authError?.message ?? null },
        { status: 401 },
      )
    }

    const { data: targetRows, error: targetError } = await supabase
      .from("nutrition_plan_rows")
      .select("date, kcal, protein_g, carbs_g, fat_g, intra_cho_g_per_h, created_at")
      .eq("user_id", user.id)
      .gte("date", start)
      .lte("date", end)
      .order("created_at", { ascending: false })

    if (targetError) {
      return NextResponse.json(
        { error: "Failed to load nutrition targets", details: targetError.message },
        { status: 400 },
      )
    }

    const targetMap = new Map<
      string,
      { kcal: number; protein_g: number; carbs_g: number; fat_g: number; intra_cho_g_per_h: number }
    >()
    ;(targetRows ?? []).forEach((row) => {
      if (!targetMap.has(row.date)) {
        targetMap.set(row.date, {
          kcal: row.kcal ?? 0,
          protein_g: row.protein_g ?? 0,
          carbs_g: row.carbs_g ?? 0,
          fat_g: row.fat_g ?? 0,
          intra_cho_g_per_h: row.intra_cho_g_per_h ?? 0,
        })
      }
    })

    const { data: plans, error: plansError } = await supabase
      .from("meal_plans")
      .select("id, date")
      .eq("user_id", user.id)
      .gte("date", start)
      .lte("date", end)

    if (plansError) {
      return NextResponse.json({ error: "Failed to load meal plans", details: plansError.message }, { status: 400 })
    }

    const planDateMap = new Map<string, string>()
    ;(plans ?? []).forEach((plan) => {
      planDateMap.set(plan.id, plan.date)
    })

    const planIds = (plans ?? []).map((plan) => plan.id)
    const consumedMap = new Map<
      string,
      { kcal: number; protein_g: number; carbs_g: number; fat_g: number; intra_cho_g_per_h: number }
    >()

    if (planIds.length > 0) {
      const { data: mealLog } = await supabase
        .from("meal_log")
        .select("date, slot, is_eaten")
        .eq("user_id", user.id)
        .gte("date", start)
        .lte("date", end)

      const eatenSlotsByDate = (mealLog ?? []).reduce((map, entry) => {
        if (!entry.is_eaten) return map
        if (!map.has(entry.date)) {
          map.set(entry.date, new Set<number>())
        }
        map.get(entry.date)?.add(entry.slot)
        return map
      }, new Map<string, Set<number>>())

      const { data: eatenItems, error: itemsError } = await supabase
        .from("meal_plan_items")
        .select("meal_plan_id, kcal, protein_g, carbs_g, fat_g, slot")
        .in("meal_plan_id", planIds)

      if (itemsError) {
        return NextResponse.json({ error: "Failed to load meals", details: itemsError.message }, { status: 400 })
      }

      ;(eatenItems ?? []).forEach((item) => {
        const date = planDateMap.get(item.meal_plan_id)
        if (!date) return
        const eatenSlots = eatenSlotsByDate.get(date)
        if (!eatenSlots || !eatenSlots.has(item.slot)) return
        const current = consumedMap.get(date) ?? {
          kcal: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          intra_cho_g_per_h: 0,
        }
        consumedMap.set(date, {
          kcal: current.kcal + (item.kcal ?? 0),
          protein_g: current.protein_g + (item.protein_g ?? 0),
          carbs_g: current.carbs_g + (item.carbs_g ?? 0),
          fat_g: current.fat_g + (item.fat_g ?? 0),
          intra_cho_g_per_h: 0,
        })
      })
    }

    const days = Array.from({ length: range.days }, (_value, index) => {
      const date = new Date(range.startDate)
      date.setUTCDate(range.startDate.getUTCDate() + index)
      const dateKey = formatDate(date)
      return {
        date: dateKey,
        consumed: consumedMap.get(dateKey) ?? {
          kcal: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          intra_cho_g_per_h: 0,
        },
        target: targetMap.get(dateKey) ?? null,
      }
    })

    return NextResponse.json({ days }, { status: 200 })
  } catch (error) {
    console.error("GET /api/v1/nutrition/week error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
