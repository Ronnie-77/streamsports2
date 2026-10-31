"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Home, Loader2, Save, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PanelCard } from "./ads-panel";
import { LogoUpload } from "./logo-upload";

export function HomePanel() {
  const [name, setName] = React.useState("StreamSpatial");
  const [logo, setLogo] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/admin/branding", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setName(d.siteName || "StreamSpatial");
        setLogo(d.siteLogo || "");
        setLoading(false);
      });
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/admin/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteName: name, siteLogo: logo || null }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PanelCard
        icon={<Home className="h-5 w-5 text-emerald-accent" />}
        title="Site branding"
        subtitle="Change the website name and logo — applied everywhere (header, footer, browser tab title)."
      >
        <div className="space-y-4">
          {/* Logo */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Site logo
            </label>
            <LogoUpload value={logo} onChange={setLogo} />
          </div>

          {/* Name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Site name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="StreamSpatial"
              className="h-10 w-full rounded-lg border border-black/10 bg-background/60 px-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 dark:border-white/10"
            />
          </div>

          {/* Live preview */}
          <div className="rounded-xl bg-white/40 p-4 ring-1 ring-black/5 dark:bg-white/[0.03] dark:ring-white/8">
            <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              Preview
            </p>
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-accent to-amber-accent shadow-spatial">
                {logo ? (
                  <img
                    src={logo}
                    alt=""
                    className="h-full w-full object-contain"
                    onError={(e) =>
                      ((e.target as HTMLImageElement).style.display = "none")
                    }
                  />
                ) : (
                  <Home className="h-5 w-5 text-white" />
                )}
              </span>
              <div className="flex flex-col leading-none">
                <span className="text-sm font-semibold tracking-tight gradient-text">
                  {name || "StreamSpatial"}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Live Sports · HD
                </span>
              </div>
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center justify-end gap-3">
            {saved && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-1 text-xs text-emerald-accent"
              >
                <Check className="h-3.5 w-3.5" /> Saved — applies site-wide
              </motion.span>
            )}
            <button
              type="button"
              onClick={save}
              disabled={saving || !name.trim()}
              className={cn(
                "flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground",
                "transition-all hover:scale-[1.02] disabled:opacity-50"
              )}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save branding
            </button>
          </div>
        </div>
      </PanelCard>
    </div>
  );
}
