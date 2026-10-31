"use client";

import * as React from "react";
import { Upload, Link as LinkIcon, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoUploadProps {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

/**
 * Logo input with two ways to set a channel logo:
 *  - paste a URL
 *  - upload an image file (converted to a base64 data URL so it needs no
 *    external storage and renders directly in <img src>)
 */
export function LogoUpload({ value, onChange, className }: LogoUploadProps) {
  const [mode, setMode] = React.useState<"url" | "upload">(
    value.startsWith("data:") ? "upload" : "url"
  );
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      setErr("Image too large (max 512KB).");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      onChange(dataUrl);
    } catch {
      setErr("Could not read file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-2">
        {/* Preview */}
        <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-black/5 ring-1 ring-black/10 dark:bg-white/8 dark:ring-white/10">
          {value ? (
            <img
              src={value}
              alt=""
              className="h-full w-full object-contain"
              onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0")}
            />
          ) : (
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          )}
        </span>
        {/* Mode toggle */}
        <div className="inline-flex items-center gap-0.5 rounded-lg bg-white/5 p-0.5 ring-1 ring-black/10 dark:ring-white/10">
          <button
            type="button"
            onClick={() => setMode("url")}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium",
              mode === "url"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LinkIcon className="h-3 w-3" /> URL
          </button>
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium",
              mode === "upload"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Upload className="h-3 w-3" /> Upload
          </button>
        </div>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-[11px] text-muted-foreground hover:text-live"
          >
            Clear
          </button>
        )}
      </div>

      {mode === "url" ? (
        <input
          value={value.startsWith("data:") ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/logo.png"
          className="h-9 w-full rounded-lg border border-black/10 bg-background/60 px-2.5 font-mono text-[11px] outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 dark:border-white/10"
        />
      ) : (
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={onFile}
          disabled={busy}
          className="h-9 w-full rounded-lg border border-black/10 bg-background/60 px-2.5 text-[11px] text-muted-foreground file:mr-2 file:rounded file:border-0 file:bg-white/10 file:px-2 file:py-0.5 file:text-[11px] file:text-foreground dark:border-white/10"
        />
      )}
      {err && <p className="text-[11px] text-live">{err}</p>}
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read error"));
    reader.readAsDataURL(file);
  });
}
