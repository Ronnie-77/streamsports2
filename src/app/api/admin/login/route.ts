import { NextResponse } from "next/server";
import {
  verifyPassword,
  createSession,
  getClientIP,
  checkLoginAllowed,
  recordFailedLogin,
  clearFailedLogins,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = getClientIP(req);

  // Rate limit: max 5 failed attempts per IP, then 15-min lockout.
  const { allowed, remaining } = checkLoginAllowed(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      { status: 429 }
    );
  }

  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const password = (body.password || "").trim();
  if (!password) {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  if (!verifyPassword(password)) {
    recordFailedLogin(ip);
    const { remaining: left } = checkLoginAllowed(ip);
    return NextResponse.json(
      {
        error: left > 0 ? `Wrong password. ${left} attempts left.` : "Account locked. Try again in 15 minutes.",
      },
      { status: 401 }
    );
  }

  clearFailedLogins(ip);
  await createSession();
  return NextResponse.json({ ok: true });
}
