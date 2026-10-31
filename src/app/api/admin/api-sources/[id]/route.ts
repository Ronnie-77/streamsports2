import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import { updateApiSource, deleteApiSource, type ApiSourceInput } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Partial<ApiSourceInput>;
  const item = await updateApiSource(id, body);
  return NextResponse.json({ item });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await deleteApiSource(id);
  return NextResponse.json({ ok: true });
}
