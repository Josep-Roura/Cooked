import { NextResponse } from "next/server";
import { getUserIdFromRequestOrThrow } from "@/lib/auth/getUserIdFromRequest";
import { getUserProfileAPI } from "@/lib/api/user";

export async function GET() {
  try {
    try {
      await getUserIdFromRequestOrThrow();
    } catch {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const profile = await getUserProfileAPI();
    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    console.error("GET /api/v1/profile/me error", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
