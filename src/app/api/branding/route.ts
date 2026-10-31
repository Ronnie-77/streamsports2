import { NextResponse } from "next/server";
import { getBranding } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** Public branding (site name + logo) for the frontend. */
export async function GET() {
  const branding = await getBranding();
  return NextResponse.json(branding, {
    headers: { "Cache-Control": "public, max-age=30, s-maxage=60" },
  });
}
