import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import { getBranding, updateBranding } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const branding = await getBranding();
  return NextResponse.json(branding);
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    siteName?: string;
    siteLogo?: string | null;
  };
  const branding = await updateBranding({
    siteName: body.siteName,
    siteLogo: body.siteLogo,
  });
  return NextResponse.json(branding);
}
