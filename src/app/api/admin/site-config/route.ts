import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import { getContentMode, setContentMode, type ContentMode } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const mode = await getContentMode();
  return NextResponse.json({ contentMode: mode });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { contentMode?: string };
  const mode = body.contentMode === "manual" ? "manual" : "auto";
  const cfg = await setContentMode(mode as ContentMode);
  return NextResponse.json({ contentMode: (cfg as Record<string, unknown>).contentMode || mode });
}
