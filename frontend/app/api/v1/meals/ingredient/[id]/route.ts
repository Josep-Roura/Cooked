import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  try {
    const supabase = await createServerClient()
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

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

    if (typeof body.checked !== "boolean") {
      return NextResponse.json({ error: "Checked flag is required." }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("meal_plan_ingredients")
      .update({ checked: body.checked })
      .eq("id", context.params.id)
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to update ingredient", details: error.message }, { status: 400 })
    }

    return NextResponse.json({ ingredient: data }, { status: 200 })
  } catch (error) {
    console.error("PATCH /api/v1/meals/ingredient/:id error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
