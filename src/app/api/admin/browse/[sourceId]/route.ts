import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import { fetchStreamsFromSource } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** Browse all streams from a specific API source (admin curation UI). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { sourceId } = await params;
  try {
    const data = await fetchStreamsFromSource(sourceId);
    if (!data) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502 }
    );
  }
}
