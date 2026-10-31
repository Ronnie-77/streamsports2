import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import { setActiveApiSource } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const item = await setActiveApiSource(id);
  return NextResponse.json({ item });
}
