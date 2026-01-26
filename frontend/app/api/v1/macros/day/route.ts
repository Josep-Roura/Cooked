import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get("date") ?? ""
    if (!DATE_REGEX.test(date)) {
      return NextResponse.json({ error: "Invalid date." }, { status: 400 })
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

    const { data: targetRow } = await supabase
      .from("nutrition_plan_rows")
      .select("kcal, protein_g, carbs_g, fat_g, intra_cho_g_per_h")
      .eq("user_id", user.id)
      .eq("date", date)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    let consumed = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, intra_cho_g_per_h: 0 }

    const { data: meals } = await supabase
      .from("nutrition_meals")
      .select("kcal, protein_g, carbs_g, fat_g, eaten")
      .eq("user_id", user.id)
      .eq("date", date)

    consumed = (meals ?? []).reduce(
      (acc, meal) => {
        if (!meal.eaten) return acc
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
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
