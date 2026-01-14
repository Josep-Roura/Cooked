import { NextResponse } from "next/server";
import { supabase } from "@/lib/server/supabase";
import { getUserIdFromRequestOrThrow } from "@/lib/auth/getUserIdFromRequest";

export async function GET() {
  try {
    let userId: string;
    try {
      userId = getUserIdFromRequestOrThrow();
    } catch {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("weekly_workouts")
      .eq("user_id", userId)
      .order("day_index", { ascending: true })
      .order("start_time", { ascending: true })
      .select(
        "id,day_index,start_time,end_time,session_type,intensity,nutrition_json"
      );

    if (error) {
      if (error.code === "config_missing") {
        return NextResponse.json(
          { error: "Configura Supabase en .env.local" },
          { status: 500 }
        );
      }
      console.error("GET /api/week error", error);
      return NextResponse.json(
        { error: "No se pudo cargar el plan semanal" },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as Array<{
      id: string;
      day_index: number;
      start_time: string;
      end_time: string;
      session_type: string;
      intensity: string | null;
      nutrition_json: Array<{ label: string; advice: string }>;
    }>;

    const week = rows.map((workout) => ({
      id: workout.id,
      day: workout.day_index,
      start: workout.start_time,
      end: workout.end_time,
      type: workout.session_type,
      intensity: workout.intensity ?? undefined,
      nutrition: workout.nutrition_json ?? []
    }));

    return NextResponse.json({ ok: true, week });
  } catch (err) {
    console.error("GET /api/week error", err);
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const workouts = Array.isArray(body?.workouts) ? body.workouts : [];

    if (
      !Array.isArray(workouts) ||
      !workouts.every(
        (w) =>
          typeof w?.day === "number" &&
          typeof w?.start === "string" &&
          typeof w?.end === "string" &&
          typeof w?.type === "string" &&
          Array.isArray(w?.nutrition)
      )
    ) {
      return NextResponse.json(
        { error: "Payload inválido" },
        { status: 400 }
      );
    }

    let userId: string;
    try {
      userId = getUserIdFromRequestOrThrow();
    } catch {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Eliminamos planificación previa del usuario
    const { error: deleteError } = await supabase
      .from("weekly_workouts")
      .eq("user_id", userId)
      .delete();

    if (deleteError) {
      if (deleteError.code === "config_missing") {
        return NextResponse.json(
          { error: "Configura Supabase en .env.local" },
          { status: 500 }
        );
      }
      console.error("POST /api/week delete error", deleteError);
      return NextResponse.json(
        { error: "No se pudo actualizar la semana" },
        { status: 500 }
      );
    }

    if (workouts.length > 0) {
      const payload = workouts.map((w) => ({
        user_id: userId,
        day_index: w.day,
        start_time: w.start,
        end_time: w.end,
        session_type: w.type,
        intensity: w.intensity ?? null,
        nutrition_json: w.nutrition
      }));

      const { error: insertError } = await supabase
        .from("weekly_workouts")
        .insert(payload);

      if (insertError) {
        if (insertError.code === "config_missing") {
          return NextResponse.json(
            { error: "Configura Supabase en .env.local" },
            { status: 500 }
          );
        }
        console.error("POST /api/week insert error", insertError);
        return NextResponse.json(
          { error: "No se pudo guardar la semana" },
          { status: 500 }
        );
      }
    }

    // TODO: conectar TrainingPeaks vía OAuth y autoimportar planificación semanal real.

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/week error", err);
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500 }
    );
  }
}
