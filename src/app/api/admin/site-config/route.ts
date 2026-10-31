import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import { getSiteConfig, setContentMode, type ContentMode } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = await getSiteConfig();
  return NextResponse.json({ contentMode: cfg.contentMode });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { contentMode?: string };
  const mode = body.contentMode === "manual" ? "manual" : "auto";
  const cfg = await setContentMode(mode as ContentMode);
  return NextResponse.json({ contentMode: cfg.contentMode });
}
