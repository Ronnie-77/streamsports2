"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Check,
  Tv,
  X,
  Upload,
  Link as LinkIcon,
  FileJson,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PanelCard } from "./ads-panel";
import { LogoUpload } from "./logo-upload";

interface Channel {
  id: string;
  name: string;
  category: string;
  logo: string | null;
  streamUrl: string;
  sourceType: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
}

export function ChannelsPanel() {
  const [items, setItems] = React.useState<Channel[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<Record<string, boolean>>({});
  const [importing, setImporting] = React.useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/channels", { cache: "no-store" });
    const d = (await res.json()) as { items: Channel[] };
    setItems(d.items);
    setLoading(false);
  }

  React.useEffect(() => {
    load();
  }, []);

  function toggle(id: string) {
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleAll() {
    setSelected((p) => {
      if (p.size === items.length) return new Set();
      return new Set(items.map((i) => i.id));
    });
  }

  async function removeSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} channel(s)?`)) return;
    await fetch("/api/admin/channels/delete-many", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    setSelected(new Set());
    load();
  }

  async function removeOne(id: string) {
    if (!confirm("Delete this channel?")) return;
    await fetch(`/api/admin/channels/${id}`, { method: "DELETE" });
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
        icon={<Tv className="h-5 w-5 text-emerald-accent" />}
        title="Manual channels"
        subtitle="Add channels manually, import from JSON/m3u files or an m3u link."
      >
        {/* Toolbar */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-accent/15 px-3 py-2 text-xs font-medium text-emerald-accent hover:bg-emerald-accent/25"
          >
            <Plus className="h-3.5 w-3.5" /> Add channel
          </button>
          <button
            type="button"
            onClick={() => setImporting((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-white/10 hover:text-foreground"
          >
            <Upload className="h-3.5 w-3.5" /> Import
          </button>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={removeSelected}
              className="flex items-center gap-1.5 rounded-lg bg-live/15 px-3 py-2 text-xs font-medium text-live hover:bg-live/25"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete {selected.size} selected
            </button>
          )}
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {items.length} total · {selected.size} selected
          </span>
        </div>

        {adding && (
          <ChannelForm
            onClose={() => setAdding(false)}
            onSaved={() => {
              setAdding(false);
              load();
            }}
          />
        )}

        {importing && (
          <ImportForm
            onClose={() => setImporting(false)}
            onImported={() => {
              setImporting(false);
              load();
            }}
          />
        )}

        {/* List */}
        {items.length === 0 ? (
          <p className="rounded-xl bg-white/4 px-4 py-6 text-center text-sm text-muted-foreground">
            No channels yet. Add one or import a playlist.
          </p>
        ) : (
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={selected.size === items.length && items.length > 0}
                onChange={toggleAll}
                className="h-4 w-4 accent-primary"
              />
              Select all
            </label>
            {items.map((c) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                  "flex items-center gap-3 rounded-xl p-2.5 ring-1 transition-all",
                  selected.has(c.id)
                    ? "bg-live/8 ring-live/30"
                    : "bg-white/4 ring-white/8"
                )}
              >
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="h-4 w-4 shrink-0 accent-primary"
                />
                {editing[c.id] ? (
                  <ChannelForm
                    channel={c}
                    onClose={() => setEditing((p) => ({ ...p, [c.id]: false }))}
                    onSaved={() => {
                      setEditing((p) => ({ ...p, [c.id]: false }));
                      load();
                    }}
                  />
                ) : (
                  <>
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white/8 ring-1 ring-white/10"
                      style={
                        c.logo
                          ? {
                              backgroundImage: `url(${c.logo})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                            }
                          : undefined
                      }
                    >
                      {!c.logo && <Tv className="h-4 w-4 text-muted-foreground" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {c.name}
                      </p>
                      <p className="truncate font-mono text-[10px] text-muted-foreground">
                        {c.streamUrl}
                      </p>
                    </div>
                    <span className="hidden shrink-0 rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
                      {c.category}
                    </span>
                    <span className="hidden shrink-0 rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] text-muted-foreground md:block">
                      {c.sourceType}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditing((p) => ({ ...p, [c.id]: true }))}
                      title="Edit"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-white/10 hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeOne(c.id)}
                      title="Delete"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-live/10 hover:text-live"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </PanelCard>
    </div>
  );
}

function ChannelForm({
  channel,
  onClose,
  onSaved,
}: {
  channel?: Channel;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState(channel?.name || "");
  const [streamUrl, setStreamUrl] = React.useState(channel?.streamUrl || "");
  const [category, setCategory] = React.useState(channel?.category || "other");
  const [logo, setLogo] = React.useState(channel?.logo || "");
  const [enabled, setEnabled] = React.useState(channel?.enabled ?? true);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const body = { name, streamUrl, category, logo: logo || null, enabled };
      const res = await fetch(
        channel ? `/api/admin/channels/${channel.id}` : "/api/admin/channels",
        {
          method: channel ? "PATCH" : "POST",
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
    <div className="mb-2 space-y-2 rounded-xl bg-background/40 p-3 border border-black/10 dark:border-white/10">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Channel name"
          className="h-9 w-full rounded-lg bg-background/60 px-2.5 text-xs outline-none border border-black/10 dark:border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category (e.g. cricket)"
          className="h-9 w-full rounded-lg bg-background/60 px-2.5 text-xs outline-none border border-black/10 dark:border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
        />
      </div>
      <input
        value={streamUrl}
        onChange={(e) => setStreamUrl(e.target.value)}
        placeholder="Stream / embed URL"
        className="h-9 w-full rounded-lg bg-background/60 px-2.5 font-mono text-[11px] outline-none border border-black/10 dark:border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
      />
      <LogoUpload value={logo} onChange={setLogo} />
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        Enabled (visible on public site)
      </label>
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
          disabled={saving || !name || !streamUrl}
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Save
        </button>
      </div>
    </div>
  );
}

function ImportForm({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (added: number) => void;
}) {
  const [link, setLink] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function importLink() {
    if (!link.trim()) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/channels/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Import failed");
      setMsg(`Imported ${d.added} channel(s) from m3u link.`);
      setLink("");
      onImported(d.added);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function importFile() {
    if (!file) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/channels/import", {
        method: "POST",
        body: fd,
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Import failed");
      setMsg(`Imported ${d.added} channel(s) from ${d.sourceType}.`);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      onImported(d.added);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-2 space-y-3 rounded-xl bg-background/40 p-3 border border-black/10 dark:border-white/10">
      {/* m3u link */}
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
          <LinkIcon className="h-3.5 w-3.5 text-emerald-accent" /> Import from m3u link
        </p>
        <div className="flex gap-2">
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://example.com/playlist.m3u"
            className="h-9 flex-1 rounded-lg bg-background/60 px-2.5 font-mono text-[11px] outline-none border border-black/10 dark:border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
          />
          <button
            type="button"
            onClick={importLink}
            disabled={busy || !link.trim()}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Import
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="h-px flex-1 bg-white/10" />
        OR
        <span className="h-px flex-1 bg-white/10" />
      </div>

      {/* file upload */}
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
          <FileJson className="h-3.5 w-3.5 text-emerald-accent" /> Upload JSON or m3u file
        </p>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".m3u,.m3u8,.json,application/json"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="h-9 flex-1 rounded-lg bg-background/60 px-2.5 text-[11px] text-muted-foreground file:mr-2 file:rounded file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-xs file:text-foreground"
          />
          <button
            type="button"
            onClick={importFile}
            disabled={busy || !file}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload
          </button>
        </div>
      </div>

      {msg && <p className="text-xs text-emerald-accent">{msg}</p>}
      {err && <p className="text-xs text-live">{err}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" /> Close
        </button>
      </div>
    </div>
  );
}
