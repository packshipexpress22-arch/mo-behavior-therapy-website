import { NextResponse } from "next/server";
import { PATIENT_COOKIE_NAME } from "@/lib/phiAuth";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PATIENT_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
