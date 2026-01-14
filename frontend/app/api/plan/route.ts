import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { generatePlanWithAI } from "@/lib/ai/generatePlan";
import { getUserIdFromRequestOrThrow } from "@/lib/auth/getUserIdFromRequest";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workoutType, durationMin, goal, weightKg, dietPrefs, notes } = body ?? {};

    if (
      typeof workoutType !== "string" ||
      typeof goal !== "string" ||
      typeof durationMin !== "number" ||
      Number.isNaN(durationMin) ||
      typeof weightKg !== "number" ||
      Number.isNaN(weightKg) ||
      typeof dietPrefs !== "string"
    ) {
      return NextResponse.json(
        { error: "Payload inválido" },
        { status: 400 }
      );
    }

    let userId: string;
    try {
      userId = await getUserIdFromRequestOrThrow(req);
    } catch {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const supabase = await createServerClient();

    const planFromAI = await generatePlanWithAI({
      workoutType,
      durationMin,
      goal,
      weightKg,
      dietPrefs,
      notes: typeof notes === "string" ? notes : ""
    });

    const { data, error } = await supabase
      .from("plans")
      .insert({
        user_id: userId,
        title: planFromAI.title,
        category: planFromAI.category,
        full_day_plan: planFromAI.full_day_plan,
        workout_type: workoutType,
        duration_min: durationMin,
        goal,
        weight_kg: weightKg,
        diet_prefs: dietPrefs,
        notes: typeof notes === "string" ? notes : ""
      });

    if (error) {
      if (error.code === "config_missing") {
        return NextResponse.json(
          { error: "Configura Supabase en .env.local" },
          { status: 500 }
        );
      }
      console.error("POST /api/plan error", error);
      return NextResponse.json(
        { error: "Error guardando el plan" },
        { status: 500 }
      );
    }

    const insertedRows = (data ?? []) as Array<{
      id: string;
      title: string;
      category: string;
      created_at: string;
    }>;
    const inserted = insertedRows[0];

    return NextResponse.json(
      {
        ok: true,
        plan: {
          id: inserted?.id,
          title: inserted?.title ?? planFromAI.title,
          category: inserted?.category ?? planFromAI.category,
          createdAt: inserted?.created_at ?? new Date().toISOString()
        }
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/plan error", err);
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    let userId: string;
    try {
      userId = await getUserIdFromRequestOrThrow();
    } catch {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("plans")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .select("id,title,category,created_at");

    if (error) {
      if (error.code === "config_missing") {
        return NextResponse.json(
          { error: "Configura Supabase en .env.local" },
          { status: 500 }
        );
      }
      console.error("GET /api/plan error", error);
      return NextResponse.json(
        { error: "No se pudieron cargar los planes" },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as Array<{
      id: string;
      title: string;
      category: string;
      created_at: string;
    }>;

    const plans = rows.map((plan) => ({
      id: plan.id,
      title: plan.title,
      category: plan.category,
      createdAt: plan.created_at
    }));

    return NextResponse.json({ ok: true, plans });
  } catch (err) {
    console.error("GET /api/plan error", err);
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500 }
    );
  }
}
