import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

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

    // Si la tabla no existe / permisos / etc:
    if (error) {
      console.error("GET /api/v1/profile/me supabase error:", error)
      return NextResponse.json(
        { error: "Database error", details: error.message, code: error.code },
        { status: 500 }
      )
    }

    // ✅ Si aún no hay perfil, devolvemos 200 y profile:null (evita 404 en frontend)
    return NextResponse.json({ profile: data ?? null }, { status: 200 })
  } catch (e: any) {
    console.error("GET /api/v1/profile/me error:", e)
    return NextResponse.json(
      { error: "Internal error", details: e?.message ?? String(e) },
      { status: 500 }
    )
  }
}
