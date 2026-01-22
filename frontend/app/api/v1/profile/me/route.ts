import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

function buildProfileSeed(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
  const metadata = user.user_metadata ?? {}
  const fullName =
    (typeof metadata["full_name"] === "string" && metadata["full_name"]) ||
    (typeof metadata["name"] === "string" && metadata["name"]) ||
    null

  return {
    id: user.id,
    email: user.email ?? null,
    full_name: fullName,
    name: fullName,
    updated_at: new Date().toISOString(),
  }
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
        { status: 401 }
      )
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()

    if (error) {
      console.error("GET /api/v1/profile/me supabase error:", error)
      return NextResponse.json(
        { error: "Database error", details: error.message, code: error.code },
        { status: 500 }
      )
    }

    if (!data) {
      const { data: createdProfile, error: upsertError } = await supabase
        .from("profiles")
        .upsert(buildProfileSeed(user), { onConflict: "id" })
        .select("*")
        .single()

      if (upsertError) {
        console.error("GET /api/v1/profile/me upsert error:", upsertError)
        return NextResponse.json(
          { error: "Failed to create profile", details: upsertError.message, code: upsertError.code },
          { status: 500 }
        )
      }

      return NextResponse.json(createdProfile, { status: 200 })
    }

    return NextResponse.json(data, { status: 200 })
  } catch (e: any) {
    console.error("GET /api/v1/profile/me error:", e)
    return NextResponse.json(
      { error: "Internal error", details: e?.message ?? String(e) },
      { status: 500 }
    )
  }
}
