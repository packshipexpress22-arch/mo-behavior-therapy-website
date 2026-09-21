import { NextRequest, NextResponse } from "next/server";
import { buildSystemPrompt } from "@/lib/chat/systemPrompt";
import { localeNames, locales, type Locale } from "@/i18n";
import { isEmergencyMessage } from "@/lib/chat/extract";

export const runtime = "nodejs";

// Simple in-memory rate limit per IP (best-effort; swap for a durable store
// like Upstash/Redis in production — see README).
const hits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

function rateLimited(ip: string) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const message: string = body?.message ?? "";
  const locale: Locale = locales.includes(body?.locale) ? body.locale : "en";

  if (!message || message.length > 2000) {
    return NextResponse.json({ error: "invalid_message" }, { status: 400 });
  }

  if (isEmergencyMessage(message)) {
    return NextResponse.json({ emergency: true });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // No key configured — the client falls back to the built-in FAQ
    // matcher + slot-filling flow, which works fully without this route.
    return NextResponse.json({ fallback: true });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
        max_tokens: 300,
        system: buildSystemPrompt(localeNames[locale]),
        messages: [{ role: "user", content: message }],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ fallback: true });
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text?.trim();
    if (!text) return NextResponse.json({ fallback: true });

    return NextResponse.json({ reply: text });
  } catch {
    // Never surface the failure to the visitor as an error — degrade to the
    // deterministic flow instead.
    return NextResponse.json({ fallback: true });
  }
}
