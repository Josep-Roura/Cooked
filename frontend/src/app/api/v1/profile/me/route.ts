import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase no configurado" },
        { status: 500 }
      );
    }

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "No se pudo cargar el perfil" },
        { status: 500 }
      );
    }

    if (profile) {
      return NextResponse.json({ ok: true, profile });
    }

    const now = new Date().toISOString();
    const fullName =
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      null;

    const { data: createdProfile, error: createError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: user.email ?? null,
          full_name: fullName,
          updated_at: now
        },
        { onConflict: "id" }
      )
      .select("*")
      .single();

    if (createError) {
      return NextResponse.json(
        { error: "No se pudo crear el perfil" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, profile: createdProfile });
  } catch (err) {
    console.error("GET /api/v1/profile/me error", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
