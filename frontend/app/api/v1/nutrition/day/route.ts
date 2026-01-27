import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"
import type { Meal, NutritionDayPlan, NutritionMacros, NutritionDayType } from "@/lib/db/types"

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

function normalizeDayType(value: string | null | undefined): NutritionDayType {
  if (value === "high" || value === "rest" || value === "training") {
    return value
  }
  return "rest"
}

function buildMeals(meals: any[]): Meal[] {
  return meals.map((meal) => ({
    slot: meal.slot,
    name: meal.name,
    time: meal.time ?? "",
    kcal: meal.kcal ?? 0,
    protein_g: meal.protein_g ?? 0,
    carbs_g: meal.carbs_g ?? 0,
    fat_g: meal.fat_g ?? 0,
    ingredients: Array.isArray(meal.ingredients) ? meal.ingredients.map((item: any) => item.name ?? "") : [],
    completed: meal.eaten ?? false,
    locked: meal.locked ?? false,
  }))
}

const updateSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    macros: z
      .object({
        kcal: z.number().nonnegative().optional(),
        protein_g: z.number().nonnegative().optional(),
        carbs_g: z.number().nonnegative().optional(),
        fat_g: z.number().nonnegative().optional(),
        intra_cho_g_per_h: z.number().nonnegative().optional(),
      })
      .optional(),
    meals: z
      .array(
        z.object({
          slot: z.number().int().min(1),
          name: z.string().min(1),
          time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
          kcal: z.number().nonnegative().optional(),
          protein_g: z.number().nonnegative().optional(),
          carbs_g: z.number().nonnegative().optional(),
          fat_g: z.number().nonnegative().optional(),
          locked: z.boolean().optional(),
        }),
      )
      .optional(),
    removedSlots: z.array(z.number().int().min(1)).optional(),
    day_locked: z.boolean().optional(),
  })
  .strict()

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const date = url.searchParams.get("date")

    if (!date || !DATE_REGEX.test(date)) {
      return jsonError(400, "invalid_date", "Invalid or missing date (YYYY-MM-DD required).")
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return jsonError(401, "unauthorized", "Not authenticated", authError?.message ?? null)
    }

    const [{ data: rows, error: rowError }, { data: meals, error: mealsError }] = await Promise.all([
      supabase
        .from("nutrition_plan_rows")
        .select("id, plan_id, date, day_type, kcal, protein_g, carbs_g, fat_g, intra_cho_g_per_h, created_at, locked")
        .eq("user_id", user.id)
        .eq("date", date)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("nutrition_meals")
        .select("slot, name, time, kcal, protein_g, carbs_g, fat_g, ingredients, eaten, locked")
        .eq("user_id", user.id)
        .eq("date", date)
        .order("slot", { ascending: true }),
    ])

    if (rowError || mealsError) {
      return jsonError(
        400,
        "db_error",
        "Database error",
        rowError?.message ?? mealsError?.message ?? "",
      )
    }

    if ((rows ?? []).length === 0 && (meals ?? []).length === 0) {
      return NextResponse.json({ exists: false }, { status: 404 })
    }

    const row = (rows ?? [])[0]

    const { data: profile } = await supabase
      .from("profiles")
      .select("meals_per_day")
      .eq("id", user.id)
      .maybeSingle()

    const macros: NutritionMacros = row
      ? {
          kcal: row.kcal,
          protein_g: row.protein_g,
          carbs_g: row.carbs_g,
          fat_g: row.fat_g,
          intra_cho_g_per_h: row.intra_cho_g_per_h,
        }
      : {
          kcal: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          intra_cho_g_per_h: 0,
        }

    const payload: NutritionDayPlan = {
      plan_id: row?.plan_id ?? null,
      date: date,
      day_type: normalizeDayType(row?.day_type),
      macros,
      meals_per_day: profile?.meals_per_day ?? (meals ?? []).length,
      meals: buildMeals(meals ?? []),
    }

    const mealLockMap = new Map((meals ?? []).map((meal) => [meal.slot, meal.locked ?? false]))

    return NextResponse.json(
      {
        ...payload,
        locked: row?.locked ?? false,
        meals: (payload.meals ?? []).map((meal) => ({
          ...meal,
          locked: mealLockMap.get(meal.slot) ?? false,
        })),
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("GET /api/v1/nutrition/day error:", error)
    return jsonError(
      500,
      "internal_error",
      "Internal error",
      error instanceof Error ? error.message : String(error),
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(400, "invalid_payload", "Invalid payload", parsed.error.issues)
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return jsonError(401, "unauthorized", "Not authenticated", authError?.message ?? null)
    }

    const { date, macros, meals, removedSlots, day_locked } = parsed.data
    const { data: existingRow } = await supabase
      .from("nutrition_plan_rows")
      .select("id, day_type, plan_id, locked, kcal, protein_g, carbs_g, fat_g, intra_cho_g_per_h")
      .eq("user_id", user.id)
      .eq("date", date)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (macros || typeof day_locked === "boolean") {
      const payload = {
        user_id: user.id,
        date,
        plan_id: existingRow?.plan_id ?? null,
        day_type: existingRow?.day_type ?? "rest",
        kcal: macros?.kcal ?? existingRow?.kcal ?? 0,
        protein_g: macros?.protein_g ?? existingRow?.protein_g ?? 0,
        carbs_g: macros?.carbs_g ?? existingRow?.carbs_g ?? 0,
        fat_g: macros?.fat_g ?? existingRow?.fat_g ?? 0,
        intra_cho_g_per_h: macros?.intra_cho_g_per_h ?? existingRow?.intra_cho_g_per_h ?? 0,
        locked: typeof day_locked === "boolean" ? day_locked : existingRow?.locked ?? false,
      }

      const { error: rowError } = await supabase
        .from("nutrition_plan_rows")
        .upsert(payload, { onConflict: "user_id,date" })

      if (rowError) {
        return jsonError(400, "db_error", "Failed to update day macros", rowError.message)
      }
    }

    if (Array.isArray(removedSlots) && removedSlots.length > 0) {
      const { error: deleteError } = await supabase
        .from("nutrition_meals")
        .delete()
        .eq("user_id", user.id)
        .eq("date", date)
        .in("slot", removedSlots)

      if (deleteError) {
        return jsonError(400, "db_error", "Failed to remove meals", deleteError.message)
      }

      await supabase
        .from("meal_log")
        .delete()
        .eq("user_id", user.id)
        .eq("date", date)
        .in("slot", removedSlots)
    }

    if (Array.isArray(meals) && meals.length > 0) {
      const payload = meals.map((meal) => ({
        user_id: user.id,
        date,
        slot: meal.slot,
        name: meal.name,
        time: meal.time ?? null,
        kcal: meal.kcal ?? 0,
        protein_g: meal.protein_g ?? 0,
        carbs_g: meal.carbs_g ?? 0,
        fat_g: meal.fat_g ?? 0,
        locked: meal.locked ?? false,
      }))

      const { error: mealError } = await supabase
        .from("nutrition_meals")
        .upsert(payload, { onConflict: "user_id,date,slot" })

      if (mealError) {
        return jsonError(400, "db_error", "Failed to update meals", mealError.message)
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error("PATCH /api/v1/nutrition/day error:", error)
    return jsonError(
      500,
      "internal_error",
      "Internal error",
      error instanceof Error ? error.message : String(error),
    )
  }
}
