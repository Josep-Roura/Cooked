import type { SupabaseClient } from "@supabase/supabase-js"

type BuildArgs = {
  userId: string
  planId: string
  start: string // YYYY-MM-DD
  end: string   // YYYY-MM-DD
  weightKg: number
  mealsPerDay: number
}

function dateRange(start: string, end: string) {
  const startDt = new Date(`${start}T00:00:00Z`)
  const endDt = new Date(`${end}T00:00:00Z`)
  const out: string[] = []
  for (let d = new Date(startDt); d.getTime() <= endDt.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}

/**
 * Heurística simple pero estable:
 * - Base kcal: 32 * kg en días con entreno / 28 * kg en días suaves / 25 * kg en rest
 * - Proteína: 1.8 g/kg
 * - Grasas: 0.9 g/kg
 * - Carbs = resto
 * - intra_cho_g_per_h depende de intensidad (si hay if/tss o planned_hours)
 */
export async function buildNutritionRowsForRange(supabase: SupabaseClient, args: BuildArgs) {
  const days = dateRange(args.start, args.end)

  // Trae entrenos del rango
  const { data: workouts, error } = await supabase
    .from("tp_workouts")
    .select("workout_day,workout_type,planned_hours,tss,if")
    .gte("workout_day", args.start)
    .lte("workout_day", args.end)

  if (error) {
    // Si falla leer entrenos, generamos igual con defaults (no rompemos ensure)
    console.warn("buildNutritionRowsForRange: tp_workouts read failed:", error)
  }

  const byDay = new Map<string, any[]>()
  for (const w of workouts ?? []) {
    const key = w.workout_day
    const arr = byDay.get(key) ?? []
    arr.push(w)
    byDay.set(key, arr)
  }

  const proteinG = Math.round(args.weightKg * 1.8)
  const fatG = Math.round(args.weightKg * 0.9)

  return days.map((day) => {
    const dayWorkouts = byDay.get(day) ?? []

    // “Carga” aproximada por horas o TSS
    const hours = dayWorkouts.reduce((acc, w) => acc + (Number(w.planned_hours ?? 0) || 0), 0)
    const tss = dayWorkouts.reduce((acc, w) => acc + (Number(w.tss ?? 0) || 0), 0)

    let dayType: "rest" | "easy" | "training" = "rest"
    if (hours >= 1.5 || tss >= 80) dayType = "training"
    else if (hours > 0 || tss > 0) dayType = "easy"

    const baseKcalPerKg = dayType === "training" ? 32 : dayType === "easy" ? 28 : 25
    const kcal = Math.round(args.weightKg * baseKcalPerKg)

    // Carbs = (kcal - (prot*4 + fat*9)) / 4
    const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4))

    // intra cho (si hay entreno)
    let intra = 0
    if (dayType !== "rest") {
      // 30-90g/h según carga
      const target = 30 + clamp(Math.round((tss / 120) * 60), 0, 60)
      intra = clamp(target, 30, 90)
    }

    return {
      plan_id: args.planId,
      user_id: args.userId,
      date: day,
      day_type: dayType,
      kcal,
      protein_g: proteinG,
      carbs_g: carbsG,
      fat_g: fatG,
      intra_cho_g_per_h: intra,
    }
  })
}
