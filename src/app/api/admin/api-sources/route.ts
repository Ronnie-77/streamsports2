import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import {
  listApiSources,
  createApiSource,
  seedDefaults,
  type ApiSourceInput,
} from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  await seedDefaults();
  const items = await listApiSources();
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<ApiSourceInput>;
  if (!body.name || !body.baseUrl) {
    return NextResponse.json(
      { error: "name and baseUrl required" },
      { status: 400 }
    );
  }
  const item = await createApiSource({
    name: body.name,
    baseUrl: body.baseUrl,
    headers: body.headers,
    docsUrl: body.docsUrl ?? null,
    active: body.active ?? false,
  });
  return NextResponse.json({ item });
}
