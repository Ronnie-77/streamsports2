"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Check,
  Server,
  Power,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PanelCard } from "./ads-panel";

interface ApiSource {
  id: string;
  name: string;
  baseUrl: string;
  headers: string;
  docsUrl: string | null;
  active: boolean;
  createdAt: string;
}

export function ApiSourcesPanel() {
  const [items, setItems] = React.useState<ApiSource[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/api-sources", { cache: "no-store" });
    const d = (await res.json()) as { items: ApiSource[] };
    setItems(d.items);
    setLoading(false);
  }

  React.useEffect(() => {
    load();
  }, []);

  async function activate(id: string) {
    await fetch(`/api/admin/api-sources/${id}/activate`, { method: "POST" });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this API source?")) return;
    await fetch(`/api/admin/api-sources/${id}`, { method: "DELETE" });
    load();
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
        icon={<Server className="h-5 w-5 text-emerald-accent" />}
        title="Stream API sources"
        subtitle="Add multiple upstream APIs and switch the active one at any time."
      >
        <div className="space-y-2">
          {items.map((s) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                "rounded-xl p-3 ring-1 transition-all",
                s.active
                  ? "bg-emerald-accent/10 ring-emerald-accent/40"
                  : "bg-white/4 ring-white/10"
              )}
            >
              {editing[s.id] ? (
                <EditForm
                  source={s}
                  onClose={() => setEditing((p) => ({ ...p, [s.id]: false }))}
                  onSaved={() => {
                    setEditing((p) => ({ ...p, [s.id]: false }));
                    load();
                  }}
                />
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {s.name}
                      </p>
                      {s.active && (
                        <span className="flex items-center gap-1 rounded-md bg-emerald-accent/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-accent">
                          <Check className="h-3 w-3" /> Active
                        </span>
                      )}
                    </div>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {s.baseUrl}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!s.active && (
                      <button
                        type="button"
                        onClick={() => activate(s.id)}
                        title="Set active"
                        className="grid h-8 w-8 place-items-center rounded-lg text-emerald-accent hover:bg-emerald-accent/15"
                      >
                        <Power className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditing((p) => ({ ...p, [s.id]: true }))}
                      title="Edit"
                      className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-white/10 hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(s.id)}
                      title="Delete"
                      className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-live/10 hover:text-live"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {adding ? (
          <div className="mt-3">
            <EditForm
              onClose={() => setAdding(false)}
              onSaved={() => {
                setAdding(false);
                load();
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-white/10 hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Add API source
          </button>
        )}
      </PanelCard>
    </div>
  );
}

function EditForm({
  source,
  onClose,
  onSaved,
}: {
  source?: ApiSource;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState(source?.name || "");
  const [baseUrl, setBaseUrl] = React.useState(source?.baseUrl || "");
  const [referer, setReferer] = React.useState(() => {
    if (!source) return "https://ondemand.st/api-docs";
    try {
      const h = JSON.parse(source.headers);
      return h.Referer || "";
    } catch {
      return "";
    }
  });
  const [docsUrl, setDocsUrl] = React.useState(source?.docsUrl || "");
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const headers = referer ? { Referer: referer } : {};
      const body = { name, baseUrl, headers, docsUrl: docsUrl || null };
      const res = await fetch(
        source
          ? `/api/admin/api-sources/${source.id}`
          : "/api/admin/api-sources",
        {
          method: source ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Save failed");
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl bg-background/40 p-3 border border-black/10 dark:border-white/10">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name (e.g. DAMITV OnDemand)"
        className="h-9 w-full rounded-lg bg-background/60 px-2.5 text-xs outline-none border border-black/10 dark:border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
      />
      <input
        value={baseUrl}
        onChange={(e) => setBaseUrl(e.target.value)}
        placeholder="Base URL (e.g. https://ondemand.st/papi/api)"
        className="h-9 w-full rounded-lg bg-background/60 px-2.5 font-mono text-[11px] outline-none border border-black/10 dark:border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
      />
      <input
        value={referer}
        onChange={(e) => setReferer(e.target.value)}
        placeholder="Referer header (e.g. https://ondemand.st/api-docs)"
        className="h-9 w-full rounded-lg bg-background/60 px-2.5 font-mono text-[11px] outline-none border border-black/10 dark:border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
      />
      <input
        value={docsUrl}
        onChange={(e) => setDocsUrl(e.target.value)}
        placeholder="Docs URL (optional)"
        className="h-9 w-full rounded-lg bg-background/60 px-2.5 font-mono text-[11px] outline-none border border-black/10 dark:border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
      />
      {err && <p className="text-xs text-live">{err}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || !name || !baseUrl}
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Save
        </button>
      </div>
    </div>
  );
}
