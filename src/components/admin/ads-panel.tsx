"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Megaphone, Loader2, Plus, Trash2, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScriptUrl {
  url: string;
  label: string;
}

interface AdConfig {
  adsEnabled: boolean;
  config: Record<string, unknown>;
  scriptUrls: string[];
}

export function AdsPanel() {
  const [cfg, setCfg] = React.useState<AdConfig | null>(null);
  const [scripts, setScripts] = React.useState<ScriptUrl[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/ad-config", { cache: "no-store" });
    const d = (await res.json()) as AdConfig;
    setCfg(d);
    setScripts(
      (d.scriptUrls || []).map((u) => ({ url: u, label: labelFromUrl(u) }))
    );
    setLoading(false);
  }

  React.useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!cfg) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/ad-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adsEnabled: cfg.adsEnabled,
          config: cfg.config,
          scriptUrls: scripts.map((s) => s.url).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setMsg("Saved");
      setTimeout(() => setMsg(null), 2000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !cfg) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PanelCard
        icon={<Megaphone className="h-5 w-5 text-emerald-accent" />}
        title="Ad master switch"
        subtitle="Globally enable or disable ad injection on the public site."
      >
        <label className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">Ads enabled</p>
            <p className="text-xs text-muted-foreground">
              When on, configured ad scripts run on the public site.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCfg({ ...cfg, adsEnabled: !cfg.adsEnabled })}
            className={cn(
              "relative h-7 w-12 rounded-full transition-colors",
              cfg.adsEnabled ? "bg-primary" : "bg-white/10"
            )}
            aria-pressed={cfg.adsEnabled}
          >
            <motion.span
              animate={{ x: cfg.adsEnabled ? 20 : 2 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="absolute top-1 h-5 w-5 rounded-full bg-white shadow"
            />
          </button>
        </label>
      </PanelCard>

      <PanelCard
        icon={<Plus className="h-5 w-5 text-emerald-accent" />}
        title="Ad scripts"
        subtitle="External script URLs to inject (e.g. popunder / banner networks)."
      >
        <div className="space-y-2">
          {scripts.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={s.label}
                onChange={(e) =>
                  setScripts((p) =>
                    p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x))
                  )
                }
                placeholder="Label"
                className="h-9 w-32 rounded-lg bg-background/50 px-2 text-xs outline-none border border-black/10 dark:border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
              <input
                value={s.url}
                onChange={(e) =>
                  setScripts((p) =>
                    p.map((x, j) => (j === i ? { ...x, url: e.target.value } : x))
                  )
                }
                placeholder="https://cdn.example/ad.js"
                className="h-9 flex-1 rounded-lg bg-background/50 px-2 text-xs outline-none border border-black/10 dark:border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
              <button
                type="button"
                onClick={() => setScripts((p) => p.filter((_, j) => j !== i))}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-live/10 hover:text-live"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setScripts((p) => [...p, { url: "", label: "" }])}
            className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-white/10 hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Add script
          </button>
        </div>
      </PanelCard>

      <div className="flex items-center justify-end gap-3">
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:scale-[1.02] disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </button>
      </div>
    </div>
  );
}

function labelFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    return "";
  }
}

export function PanelCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass shadow-spatial rounded-2xl p-5"
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 ring-1 ring-white/10">
          {icon}
        </span>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </motion.div>
  );
}
