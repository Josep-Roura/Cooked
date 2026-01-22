import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const allowedKeys = new Set([
  "email",
  "full_name",
  "avatar_url",
  "meta",
  "name",
  "height_cm",
  "weight_kg",
  "units",
  "primary_goal",
  "experience_level",
  "event",
  "sports",
  "workout_time",
  "diet",
  "meals_per_day",
  "cooking_time_min",
  "budget",
  "kitchen",
  "trainingpeaks_connected"
]);

function parseNumberField(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") {
    return { value: null };
  }

  const numberValue =
    typeof value === "number" ? value : Number(String(value));

  if (Number.isNaN(numberValue)) {
    return { error: `${field} debe ser numérico` };
  }

  return { value: numberValue };
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === "string")
  );
}

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

    if (!profile) {
      return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    console.error("GET /api/v1/profile error", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
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

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }

    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (!allowedKeys.has(key)) {
        return NextResponse.json({ error: "Campo no permitido" }, { status: 400 });
      }

      if (
        [
          "email",
          "full_name",
          "avatar_url",
          "name",
          "primary_goal",
          "experience_level",
          "event",
          "workout_time",
          "diet",
          "budget",
          "kitchen"
        ].includes(key)
      ) {
        if (value === null || value === undefined || value === "") {
          payload[key] = null;
        } else if (typeof value === "string") {
          payload[key] = value;
        } else {
          return NextResponse.json(
            { error: `${key} debe ser texto` },
            { status: 400 }
          );
        }
        continue;
      }

      if (key === "meta") {
        if (value === null || value === undefined) {
          payload[key] = null;
        } else if (typeof value === "object" && !Array.isArray(value)) {
          payload[key] = value;
        } else {
          return NextResponse.json(
            { error: "meta debe ser un objeto" },
            { status: 400 }
          );
        }
        continue;
      }

      if (key === "trainingpeaks_connected") {
        if (value === null || value === undefined) {
          payload[key] = null;
        } else if (typeof value === "boolean") {
          payload[key] = value;
        } else {
          return NextResponse.json(
            { error: "trainingpeaks_connected debe ser booleano" },
            { status: 400 }
          );
        }
        continue;
      }

      if (key === "units") {
        if (value === null || value === undefined || value === "") {
          payload[key] = null;
        } else if (value === "metric" || value === "imperial") {
          payload[key] = value;
        } else {
          return NextResponse.json(
            { error: "units debe ser 'metric' o 'imperial'" },
            { status: 400 }
          );
        }
        continue;
      }

      if (key === "sports") {
        if (value === null || value === undefined) {
          payload[key] = null;
        } else if (isStringArray(value)) {
          payload[key] = value;
        } else {
          return NextResponse.json(
            { error: "sports debe ser un array de strings" },
            { status: 400 }
          );
        }
        continue;
      }

      if (
        ["height_cm", "weight_kg", "meals_per_day", "cooking_time_min"].includes(
          key
        )
      ) {
        const parsed = parseNumberField(value, key);
        if ("error" in parsed) {
          return NextResponse.json({ error: parsed.error }, { status: 400 });
        }

        if (parsed.value === null) {
          payload[key] = null;
          continue;
        }

        if (key === "weight_kg" && (parsed.value < 20 || parsed.value > 250)) {
          return NextResponse.json(
            { error: "weight_kg fuera de rango" },
            { status: 400 }
          );
        }

        if (key === "height_cm" && (parsed.value < 100 || parsed.value > 230)) {
          return NextResponse.json(
            { error: "height_cm fuera de rango" },
            { status: 400 }
          );
        }

        if (
          key === "meals_per_day" &&
          (parsed.value < 1 || parsed.value > 10)
        ) {
          return NextResponse.json(
            { error: "meals_per_day fuera de rango" },
            { status: 400 }
          );
        }

        if (
          key === "cooking_time_min" &&
          (parsed.value < 0 || parsed.value > 600)
        ) {
          return NextResponse.json(
            { error: "cooking_time_min fuera de rango" },
            { status: 400 }
          );
        }

        payload[key] = parsed.value;
        continue;
      }
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json(
        { error: "No hay cambios para guardar" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { data: existingProfile, error: existingError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: "No se pudo validar el perfil" },
        { status: 500 }
      );
    }

    if (!existingProfile) {
      const fullName =
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        null;

      const { data: createdProfile, error: createError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email ?? null,
          full_name: fullName,
          updated_at: now,
          ...payload
        })
        .select("*")
        .single();

      if (createError) {
        return NextResponse.json(
          { error: "No se pudo crear el perfil" },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true, profile: createdProfile });
    }

    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update({
        ...payload,
        updated_at: now
      })
      .eq("id", user.id)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "No se pudo actualizar el perfil" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, profile: updatedProfile });
  } catch (err) {
    console.error("PATCH /api/v1/profile error", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
