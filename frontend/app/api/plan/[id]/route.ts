import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { getUserIdFromRequestOrThrow } from "@/lib/auth/getUserIdFromRequest"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id: planId } = await ctx.params

    if (!planId) {
      return NextResponse.json({ error: "PlanId requerido" }, { status: 400 })
    }

    let userId: string
    try {
      // ✅ ahora sí le pasamos el Request, para que pueda leer cookies/headers
      userId = await getUserIdFromRequestOrThrow(req)
    } catch {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from("plans")
      .select(
        "id,title,category,full_day_plan,workout_type,duration_min,goal,weight_kg,diet_prefs,notes,created_at"
      )
      .eq("user_id", userId)
      .eq("id", planId)
      .limit(1)

    if (error) {
      console.error(`GET /api/plan/${planId} error`, error)
      return NextResponse.json({ error: "No se pudo cargar el plan" }, { status: 500 })
    }

    const rows = (data ?? []) as Array<{
      id: string
      title: string
      category: string
      full_day_plan: Record<string, unknown>
      workout_type: string | null
      duration_min: number | null
      goal: string | null
      weight_kg: number | null
      diet_prefs: string | null
      notes: string | null
      created_at: string
    }>

    const plan = rows[0]
    if (!plan) {
      return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      plan: {
        id: plan.id,
        title: plan.title,
        category: plan.category,
        fullDayPlan: plan.full_day_plan,
        workoutType: plan.workout_type,
        durationMin: plan.duration_min,
        goal: plan.goal,
        weightKg: plan.weight_kg,
        dietPrefs: plan.diet_prefs,
        notes: plan.notes,
        createdAt: plan.created_at,
      },
    })
  } catch (err) {
    console.error("GET /api/plan/[id] error", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
