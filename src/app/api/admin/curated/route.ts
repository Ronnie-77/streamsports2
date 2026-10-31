import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import { listCurated, addCuratedMatch, type CuratedMatchInput } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await listCurated();
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<CuratedMatchInput>;
  if (!body.streamId || !body.name) {
    return NextResponse.json(
      { error: "streamId and name required" },
      { status: 400 }
    );
  }
  const item = await addCuratedMatch({
    sourceApiId: body.sourceApiId ?? null,
    streamId: body.streamId,
    name: body.name,
    category: body.category,
    poster: body.poster ?? null,
    league: body.league ?? null,
    startsAt: body.startsAt ?? null,
    endsAt: body.endsAt ?? null,
    status: body.status || "upcoming",
    teams: body.teams ?? null,
    sources: body.sources ?? null,
    embed: body.embed ?? null,
    iframe: body.iframe ?? null,
  });
  return NextResponse.json({ item });
}
