import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"

const querySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
})

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const query = querySchema.parse({
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
    })

    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let queryBuilder = supabase
      .from("workout_nutrition")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("workout_date", { ascending: false })

    // Apply date filters if provided
    if (query.startDate) {
      queryBuilder = queryBuilder.gte("workout_date", query.startDate)
    }
    if (query.endDate) {
      queryBuilder = queryBuilder.lte("workout_date", query.endDate)
    }

    // Apply pagination
    queryBuilder = queryBuilder
      .range(query.offset, query.offset + query.limit - 1)

    const { data: records, error: recordError, count } = await queryBuilder

    if (recordError) {
      return NextResponse.json(
        { error: "Failed to fetch records" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        records: records ?? [],
        total: count ?? 0,
        limit: query.limit,
        offset: query.offset,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("GET /api/v1/nutrition/during-workout error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
