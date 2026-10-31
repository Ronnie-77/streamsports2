import "server-only";
import { cookies } from "next/headers";

// Simple cookie-based admin auth.
// The admin password is read from ADMIN_PASSWORD env (required in production).
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Ronnie7700???";
const SESSION_COOKIE = "ss_admin_session";
const SESSION_VALUE = "authenticated";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// Rate limiting: track failed attempts per IP (in-memory).
const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_FAILED = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = failedAttempts.get(ip);
  if (entry && now - entry.lastAttempt < LOCKOUT_MS && entry.count >= MAX_FAILED) {
    return { allowed: false, remaining: 0 };
  }
  if (entry && now - entry.lastAttempt > LOCKOUT_MS) {
    failedAttempts.delete(ip);
  }
  const count = entry?.count || 0;
  return { allowed: true, remaining: MAX_FAILED - count };
}

function recordFailedAttempt(ip: string) {
  const now = Date.now();
  const entry = failedAttempts.get(ip);
  if (entry && now - entry.lastAttempt < LOCKOUT_MS) {
    entry.count++;
    entry.lastAttempt = now;
  } else {
    failedAttempts.set(ip, { count: 1, lastAttempt: now });
  }
}

function clearAttempts(ip: string) {
  failedAttempts.delete(ip);
}

export function getClientIP(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

export function verifyPassword(password: string): boolean {
  return password === ADMIN_PASSWORD;
}

export function checkLoginAllowed(ip: string): { allowed: boolean; remaining: number } {
  return checkRateLimit(ip);
}

export function recordFailedLogin(ip: string) {
  recordFailedAttempt(ip);
}

export function clearFailedLogins(ip: string) {
  clearAttempts(ip);
}

export async function createSession() {
  const store = await cookies();
  store.set(SESSION_COOKIE, SESSION_VALUE, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const c = store.get(SESSION_COOKIE);
  return c?.value === SESSION_VALUE;
}

/** Throw if the current request is not an authenticated admin. */
export async function requireAdmin() {
  if (!(await isAuthenticated())) {
    throw new Response("Unauthorized", { status: 401 });
  }
}
