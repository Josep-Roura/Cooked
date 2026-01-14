import { NextResponse } from "next/server";
import { supabase } from "@/lib/server/supabase";
import { getUserIdFromRequestOrThrow } from "@/lib/auth/getUserIdFromRequest";

type ReminderRow = {
  enabled: boolean | null;
  offset_minutes: number | null;
};

type ReminderSettings = {
  enabled: boolean;
  offsetMinutes: number;
};

const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: true,
  offsetMinutes: 30
};

export async function GET() {
  let userId: string;
  try {
    userId = getUserIdFromRequestOrThrow();
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("reminders")
    .eq("user_id", userId)
    .limit(1)
    .select("enabled,offset_minutes");

  if (error) {
    if (error.code === "config_missing") {
      return NextResponse.json(
        { error: "Configura Supabase en .env.local" },
        { status: 500 }
      );
    }
    console.error("GET /api/reminders error", error);
    return NextResponse.json(
      { error: "No se pudieron cargar los recordatorios" },
      { status: 500 }
    );
  }

  const row = (data ?? [])[0] as ReminderRow | undefined;
  const settings = row
    ? {
        enabled: row.enabled ?? DEFAULT_SETTINGS.enabled,
        offsetMinutes: row.offset_minutes ?? DEFAULT_SETTINGS.offsetMinutes
      }
    : DEFAULT_SETTINGS;

  return NextResponse.json({ ok: true, settings });
}

export async function POST(req: Request) {
  let userId: string;
  try {
    userId = getUserIdFromRequestOrThrow();
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json();
  const enabled = Boolean(body?.enabled);
  const offsetMinutes = Number(body?.offsetMinutes);

  if (!Number.isFinite(offsetMinutes) || offsetMinutes <= 0) {
    return NextResponse.json(
      { error: "Offset inválido" },
      { status: 400 }
    );
  }

  const payload = {
    user_id: userId,
    enabled,
    offset_minutes: Math.round(offsetMinutes)
  };

  const { error } = await supabase
    .from("reminders")
    .insert(payload, { upsert: true });

  if (error) {
    if (error.code === "config_missing") {
      return NextResponse.json(
        { error: "Configura Supabase en .env.local" },
        { status: 500 }
      );
    }
    console.error("POST /api/reminders error", error);
    return NextResponse.json(
      { error: "No se pudieron guardar los recordatorios" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    settings: {
      enabled,
      offsetMinutes: Math.round(offsetMinutes)
    }
  });
}
