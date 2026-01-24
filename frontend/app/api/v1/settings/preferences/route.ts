import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

type PreferencesPayload = {
  units: "metric" | "imperial"
  theme: "light" | "dark"
  notifications_enabled: boolean
}

const THEMES = new Set(["light", "dark"])
const UNITS = new Set(["metric", "imperial"])

function buildPreferences(profile: { units: string | null; meta: Record<string, unknown> | null }): PreferencesPayload {
  const meta = profile.meta && typeof profile.meta === "object" ? profile.meta : {}
  const theme = typeof meta.theme === "string" && THEMES.has(meta.theme) ? (meta.theme as "light" | "dark") : "light"
  const notifications_enabled =
    typeof meta.notifications_enabled === "boolean" ? meta.notifications_enabled : true
  const units = UNITS.has(profile.units ?? "") ? (profile.units as "metric" | "imperial") : "metric"

  return { units, theme, notifications_enabled }
}

export async function GET(_req: NextRequest) {
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("units, meta")
      .eq("id", user.id)
      .single()

    if (profileError) {
      return NextResponse.json(
        { error: "Profile lookup failed", details: profileError.message, code: profileError.code },
        { status: 400 },
      )
    }

    const preferences = buildPreferences({
      units: profile.units ?? null,
      meta: profile.meta && typeof profile.meta === "object" ? profile.meta : null,
    })

    return NextResponse.json(preferences, { status: 200 })
  } catch (error) {
    console.error("GET /api/v1/settings/preferences error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest) {
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

    const nextUnits = typeof body.units === "string" ? body.units : undefined
    const nextTheme = typeof body.theme === "string" ? body.theme : undefined
    const nextNotifications =
      typeof body.notifications_enabled === "boolean" ? body.notifications_enabled : undefined

    if (nextUnits && !UNITS.has(nextUnits)) {
      return NextResponse.json({ error: "Invalid units value" }, { status: 400 })
    }
    if (nextTheme && !THEMES.has(nextTheme)) {
      return NextResponse.json({ error: "Invalid theme value" }, { status: 400 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("units, meta")
      .eq("id", user.id)
      .single()

    if (profileError) {
      return NextResponse.json(
        { error: "Profile lookup failed", details: profileError.message, code: profileError.code },
        { status: 400 },
      )
    }

    const meta = profile.meta && typeof profile.meta === "object" ? profile.meta : {}
    const updatedMeta = {
      ...meta,
      ...(nextTheme ? { theme: nextTheme } : {}),
      ...(typeof nextNotifications === "boolean" ? { notifications_enabled: nextNotifications } : {}),
    }

    const updatePayload: { meta: Record<string, unknown>; units?: "metric" | "imperial"; updated_at: string } = {
      meta: updatedMeta,
      updated_at: new Date().toISOString(),
    }
    if (nextUnits) {
      updatePayload.units = nextUnits as "metric" | "imperial"
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id)

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update preferences", details: updateError.message, code: updateError.code },
        { status: 400 },
      )
    }

    const preferences = buildPreferences({
      units: nextUnits ?? profile.units ?? null,
      meta: updatedMeta,
    })

    return NextResponse.json(preferences, { status: 200 })
  } catch (error) {
    console.error("PATCH /api/v1/settings/preferences error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
