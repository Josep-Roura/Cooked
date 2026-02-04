import { NextRequest, NextResponse } from "next/server"
import { z } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Get product (must be default or belong to user)
    const { data, error } = await supabase
      .from("nutrition_products")
      .select("*")
      .eq("id", id)
      .or(`user_id.eq.${user.id},is_default.eq.true`)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in GET /api/v1/nutrition/products/[id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Update product (only if owned by user)
    const { data, error } = await supabase
      .from("nutrition_products")
      .update(body)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Product not found or not owned by user" }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in PATCH /api/v1/nutrition/products/[id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Delete product (only if owned by user)
    const { error } = await supabase
      .from("nutrition_products")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: "Product not found or not owned by user" }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error in DELETE /api/v1/nutrition/products/[id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
