import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import { listChannels, createChannel, type ChannelInput } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await listChannels();
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<ChannelInput>;
  if (!body.name || !body.streamUrl) {
    return NextResponse.json(
      { error: "name and streamUrl required" },
      { status: 400 }
    );
  }
  const item = await createChannel({
    name: body.name,
    streamUrl: body.streamUrl,
    category: body.category,
    logo: body.logo,
    sourceType: body.sourceType || "manual",
    enabled: body.enabled ?? true,
    tags: body.tags,
    sortOrder: body.sortOrder,
  });
  return NextResponse.json({ item });
}
