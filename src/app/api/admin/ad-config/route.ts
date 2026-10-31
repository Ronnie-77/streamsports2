import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import { getAdConfig, updateAdConfig } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const row = await getAdConfig();
  return NextResponse.json({
    adsEnabled: row._parsed.adsEnabled,
    config: row._parsed.config,
    scriptUrls: row._parsed.scriptUrls,
  });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    adsEnabled?: boolean;
    config?: Record<string, unknown>;
    scriptUrls?: string[];
  };
  const row = await updateAdConfig({
    adsEnabled: body.adsEnabled,
    config: body.config,
    scriptUrls: body.scriptUrls,
  });
  return NextResponse.json({ ok: true, updatedAt: row.updatedAt });
}
