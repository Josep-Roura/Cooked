import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"

const payloadSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.number().int().nonnegative(),
  eaten: z.boolean(),
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null)
    const parsed = payloadSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
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

    const { date, slot, eaten } = parsed.data
    const eatenAt = eaten ? new Date().toISOString() : null

    const { data, error } = await supabase
      .from("nutrition_meals")
      .update({ eaten, eaten_at: eatenAt })
      .eq("user_id", user.id)
      .eq("date", date)
      .eq("slot", slot)
      .select("id, date, slot, eaten, eaten_at")
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to update meal", details: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, meal: data }, { status: 200 })
  } catch (error) {
    console.error("POST /api/v1/nutrition/meal/toggle error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
