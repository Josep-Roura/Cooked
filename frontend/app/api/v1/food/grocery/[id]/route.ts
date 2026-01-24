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

    const updates: Record<string, unknown> = {}
    if (typeof body.name === "string") updates.name = body.name.trim()
    if (typeof body.quantity === "number") updates.quantity = body.quantity
    if (body.quantity === null) updates.quantity = null
    if (typeof body.unit === "string") updates.unit = body.unit.trim()
    if (body.unit === null) updates.unit = null
    if (typeof body.category === "string") updates.category = body.category.trim()
    if (body.category === null) updates.category = null
    if (typeof body.is_bought === "boolean") updates.is_bought = body.is_bought

    const { data, error } = await supabase
      .from("grocery_items")
      .update(updates)
      .eq("id", context.params.id)
      .eq("user_id", user.id)
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to update grocery item", details: error.message }, { status: 400 })
    }

    return NextResponse.json({ item: data }, { status: 200 })
  } catch (error) {
    console.error("PATCH /api/v1/food/grocery/:id error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
