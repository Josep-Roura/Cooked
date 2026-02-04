import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"

const productSchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional(),
  category: z.enum(["drink", "food", "supplement", "bar", "gel", "salt_capsule", "other"]),
  serving_size: z.number().positive(),
  serving_unit: z.enum(["g", "ml", "pieces", "packet", "capsule", "tablet"]),
  calories: z.number().optional(),
  carbs_g: z.number().optional(),
  protein_g: z.number().optional(),
  sodium_mg: z.number().optional(),
  description: z.string().optional(),
  price_usd: z.number().optional(),
  is_vegan: z.boolean().optional(),
  is_gluten_free: z.boolean().optional(),
  is_dairy_free: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get("category")
    const search = searchParams.get("search")
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
    const offset = parseInt(searchParams.get("offset") || "0")

    let query = supabase
      .from("nutrition_products")
      .select("*", { count: "exact" })
      .or(`user_id.eq.${user.id},is_default.eq.true`)

    if (category) {
      query = query.eq("category", category)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,brand.ilike.%${search}%`)
    }

    const { data, count, error } = await query
      .order("is_default", { ascending: false })
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("Error fetching products:", error)
      return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
    }

    return NextResponse.json({
      products: data,
      total: count,
      limit,
      offset,
    })
  } catch (error) {
    console.error("Error in GET /api/v1/nutrition/products:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const product = productSchema.parse(body)

    // Insert product
    const { data, error } = await supabase
      .from("nutrition_products")
      .insert({
        user_id: user.id,
        ...product,
        is_default: false,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating product:", error)
      return NextResponse.json({ error: "Failed to create product" }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Error in POST /api/v1/nutrition/products:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request format", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
