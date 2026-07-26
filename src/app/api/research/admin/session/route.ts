import { NextRequest, NextResponse } from "next/server";
import { createResearchAdminSession, RESEARCH_ADMIN_COOKIE } from "@/lib/research-admin-auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (!process.env.RESEARCH_ADMIN_PASSWORD || body.password !== process.env.RESEARCH_ADMIN_PASSWORD) return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  const session = createResearchAdminSession();
  if (!session) return NextResponse.json({ error: "Admin login is not configured." }, { status: 500 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(RESEARCH_ADMIN_COOKIE, session, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(RESEARCH_ADMIN_COOKIE, "", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
