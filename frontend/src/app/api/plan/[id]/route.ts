import { NextResponse } from "next/server";
import { supabase } from "@/lib/server/supabase";
import { getUserIdFromRequestOrThrow } from "@/lib/auth/getUserIdFromRequest";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params;
    if (!planId) {
      return NextResponse.json(
        { error: "PlanId requerido" },
        { status: 400 }
      );
    }

    let userId: string;
    try {
      userId = await getUserIdFromRequestOrThrow();
    } catch {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("plans")
      .eq("user_id", userId)
      .eq("id", planId)
      .limit(1)
      .select(
        "id,title,category,full_day_plan,workout_type,duration_min,goal,weight_kg,diet_prefs,notes,created_at"
      );

    if (error) {
      if (error.code === "config_missing") {
        return NextResponse.json(
          { error: "Configura Supabase en .env.local" },
          { status: 500 }
        );
      }
      console.error(`GET /api/plan/${planId} error`, error);
      return NextResponse.json(
        { error: "No se pudo cargar el plan" },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as Array<{
      id: string;
      title: string;
      category: string;
      full_day_plan: Record<string, unknown>;
      workout_type: string | null;
      duration_min: number | null;
      goal: string | null;
      weight_kg: number | null;
      diet_prefs: string | null;
      notes: string | null;
      created_at: string;
    }>;

    const plan = rows[0];
    if (!plan) {
      return NextResponse.json(
        { error: "Plan no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      plan: {
        id: plan.id,
        title: plan.title,
        category: plan.category,
        fullDayPlan: plan.full_day_plan,
        workoutType: plan.workout_type,
        durationMin: plan.duration_min,
        goal: plan.goal,
        weightKg: plan.weight_kg,
        dietPrefs: plan.diet_prefs,
        notes: plan.notes,
        createdAt: plan.created_at
      }
    });
  } catch (err) {
    console.error("GET /api/plan/[id] error", err);
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500 }
    );
  }
}
