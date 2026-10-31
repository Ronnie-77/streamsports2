import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/admin-auth";
import { createManyChannels } from "@/lib/admin";
import {
  parseM3u,
  parseJsonChannels,
  fetchAndParseM3u,
  parsedToChannelInput,
} from "@/lib/parse";

export const dynamic = "force-dynamic";

interface ImportResult {
  added: number;
  sourceType: string;
  preview: { name: string; streamUrl: string }[];
}

/** Import channels from an uploaded file (m3u/json) or an m3u link. */
export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") || "";
  let parsed: ReturnType<typeof parseM3u> = [];
  let sourceType: "json" | "m3u-file" | "m3u-link" = "m3u-file";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") as File | null;
      const link = (form.get("link") as string | null)?.trim();
      if (file) {
        const text = await file.text();
        const name = (file.name || "").toLowerCase();
        if (name.endsWith(".json") || text.trim().startsWith("[") || text.trim().startsWith("{")) {
          parsed = parseJsonChannels(text);
          sourceType = "json";
        } else {
          parsed = parseM3u(text);
          sourceType = "m3u-file";
        }
      } else if (link) {
        parsed = await fetchAndParseM3u(link);
        sourceType = "m3u-link";
      } else {
        return NextResponse.json(
          { error: "Provide a 'file' or 'link' field" },
          { status: 400 }
        );
      }
    } else {
      // JSON body: { "link": "https://..." } or { "text": "...", "format": "m3u|json" }
      const body = (await req.json().catch(() => ({}))) as {
        link?: string;
        text?: string;
        format?: string;
      };
      if (body.link) {
        parsed = await fetchAndParseM3u(body.link);
        sourceType = "m3u-link";
      } else if (body.text) {
        const fmt = (body.format || "").toLowerCase();
        if (fmt === "json" || body.text.trim().startsWith("[") || body.text.trim().startsWith("{")) {
          parsed = parseJsonChannels(body.text);
          sourceType = "json";
        } else {
          parsed = parseM3u(body.text);
          sourceType = "m3u-file";
        }
      } else {
        return NextResponse.json(
          { error: "Provide 'link' or 'text'" },
          { status: 400 }
        );
      }
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Parse failed" },
      { status: 400 }
    );
  }

  if (parsed.length === 0) {
    return NextResponse.json(
      { error: "No channels found in the provided source" },
      { status: 400 }
    );
  }

  const inputs = parsedToChannelInput(parsed, sourceType);
  const added = await createManyChannels(inputs);
  const result: ImportResult = {
    added,
    sourceType,
    preview: parsed.slice(0, 8).map((p) => ({ name: p.name, streamUrl: p.streamUrl })),
  };
  return NextResponse.json(result);
}
