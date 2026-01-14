import { NextResponse } from "next/server";
import { getUserIdFromRequestOrThrow } from "@/lib/auth/getUserIdFromRequest";
import { getUserProfileAPI, updateUserProfileAPI } from "@/lib/api/user";

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
    console.error("GET /api/v1/profile error", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    try {
      await getUserIdFromRequestOrThrow();
    } catch {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const { name, email, language } = body ?? {};

    if (typeof name !== "string" || typeof email !== "string" || typeof language !== "string") {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }

    const profile = await updateUserProfileAPI({ name, email, language });
    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    console.error("POST /api/v1/profile error", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
