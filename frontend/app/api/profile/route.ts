import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"

const profileUpdateSchema = z.object({
  full_name: z.string().nullable().optional(),
  weight_kg: z.number().nullable().optional(),
  meals_per_day: z.number().nullable().optional(),
  diet: z.string().nullable().optional(),
  units: z.enum(["metric", "imperial"]).nullable().optional(),
  primary_goal: z.string().nullable().optional(),
  event: z.string().nullable().optional(),
  experience_level: z.string().nullable().optional(),
  sports: z.array(z.string()).nullable().optional(),
  workout_time: z.string().nullable().optional(),
  cooking_time_min: z.number().nullable().optional(),
  budget: z.string().nullable().optional(),
  kitchen: z.string().nullable().optional(),
  trainingpeaks_connected: z.boolean().nullable().optional(),
  accept_terms: z.boolean().nullable().optional(),
  accept_terms_at: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  height_cm: z.number().nullable().optional(),
})

function buildUpdatePayload(input: z.infer<typeof profileUpdateSchema>) {
  const entries = Object.entries(input).filter(([, value]) => value !== undefined)
  return Object.fromEntries(entries)
}

export async function GET() {
  try {
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

    const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single()

    if (error) {
      return NextResponse.json({ error: "Failed to load profile", details: error.message }, { status: 400 })
    }

    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error("GET /api/profile error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null)
    const parsed = profileUpdateSchema.safeParse(json)
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

    const payload = buildUpdatePayload(parsed.data)

    if (payload.accept_terms === true && !payload.accept_terms_at) {
      payload.accept_terms_at = new Date().toISOString()
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", user.id)
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to update profile", details: error.message }, { status: 400 })
    }

    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error("PATCH /api/profile error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
