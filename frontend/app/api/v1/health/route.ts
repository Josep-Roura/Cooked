import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { error } = await supabase.from("profiles").select("id").limit(1)
    if (error) {
      return NextResponse.json({ ok: false, status: "db_error", details: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, status: "ok" }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, status: "internal_error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
