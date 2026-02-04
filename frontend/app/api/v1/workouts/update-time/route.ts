import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"

const updateTimeSchema = z.object({
  workoutId: z.number(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
})

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
    const { workoutId, startTime } = updateTimeSchema.parse(body)

    // Update the workout's start_time
    const { error } = await supabase
      .from("tp_workouts")
      .update({ start_time: startTime })
      .eq("id", workoutId)
      .eq("user_id", user.id)

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to update workout time" }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      message: "Workout time updated successfully",
    })
  } catch (error) {
    console.error("Error in update-time:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request format" }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
