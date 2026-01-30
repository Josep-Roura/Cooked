import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

type ErrorPayload = {
  ok: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

function jsonError(status: number, code: string, message: string, details?: unknown) {
  const payload: ErrorPayload = { ok: false, error: { code, message, details } }
  return NextResponse.json(payload, { status })
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get("date") ?? ""
    if (!DATE_REGEX.test(date)) {
      return jsonError(400, "invalid_date", "Invalid date.")
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return jsonError(401, "unauthorized", "Not authenticated", authError?.message ?? null)
    }

    const { data: targetRow, error: targetError } = await supabase
      .from("nutrition_plan_rows")
      .select("kcal, protein_g, carbs_g, fat_g, intra_cho_g_per_h")
      .eq("user_id", user.id)
      .eq("date", date)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (targetError) {
      return jsonError(400, "db_error", "Failed to load macro targets", targetError.message)
    }

    let consumed = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, intra_cho_g_per_h: 0 }

    const [{ data: meals, error: mealsError }, { data: mealLog, error: logError }] = await Promise.all([
      supabase
        .from("nutrition_meals")
        .select("slot, kcal, protein_g, carbs_g, fat_g, eaten")
        .eq("user_id", user.id)
        .eq("date", date),
      supabase
        .from("meal_log")
        .select("slot, is_eaten")
        .eq("user_id", user.id)
        .eq("date", date),
    ])

    if (mealsError || logError) {
      return jsonError(
        400,
        "db_error",
        "Failed to load meals",
        mealsError?.message ?? logError?.message ?? null,
      )
    }

    const mealMap = new Map((meals ?? []).map((meal) => [meal.slot, meal]))
    const logMap = new Map((mealLog ?? []).map((log) => [log.slot, log.is_eaten]))

    consumed = Array.from(mealMap.entries()).reduce(
      (acc, [slot, meal]) => {
        const eaten = logMap.has(slot) ? Boolean(logMap.get(slot)) : meal.eaten ?? false
        if (!eaten) return acc
        acc.kcal += meal.kcal ?? 0
        acc.protein_g += meal.protein_g ?? 0
        acc.carbs_g += meal.carbs_g ?? 0
        acc.fat_g += meal.fat_g ?? 0
        return acc
      },
      { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, intra_cho_g_per_h: 0 },
    )

    const target = targetRow
      ? {
          kcal:
            targetRow.kcal ??
            (targetRow.protein_g ?? 0) * 4 + (targetRow.carbs_g ?? 0) * 4 + (targetRow.fat_g ?? 0) * 9,
          protein_g: targetRow.protein_g ?? 0,
          carbs_g: targetRow.carbs_g ?? 0,
          fat_g: targetRow.fat_g ?? 0,
          intra_cho_g_per_h: targetRow.intra_cho_g_per_h ?? 0,
        }
      : null

    const percent = target?.kcal ? Math.round((consumed.kcal / target.kcal) * 100) : 0

    return NextResponse.json({ date, target, consumed, percent }, { status: 200 })
  } catch (error) {
    console.error("GET /api/v1/macros/day error:", error)
    return jsonError(
      500,
      "internal_error",
      "Internal error",
      error instanceof Error ? error.message : String(error),
    )
  }
}
