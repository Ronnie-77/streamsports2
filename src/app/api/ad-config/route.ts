import { NextResponse } from "next/server";
import { getAdConfig } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** Public ad config for the frontend (no auth). */
export async function GET() {
  const row = await getAdConfig();
  return NextResponse.json({
    adsEnabled: row._parsed.adsEnabled,
    config: row._parsed.config,
    scriptUrls: row._parsed.scriptUrls,
  });
}
