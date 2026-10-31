"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Plus,
  Trash2,
  Check,
  Search,
  Server,
  Star,
  Eye,
  EyeOff,
  Tv,
  Zap,
  Hand,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PanelCard } from "./ads-panel";
import { LogoUpload } from "./logo-upload";

interface ApiSource {
  id: string;
  name: string;
  active: boolean;
}

interface BrowseSource {
  name?: string;
  embed?: string;
  hd?: number;
  sd?: number;
}
interface BrowseStream {
  id: string;
  name: string;
  status: string;
  category_name: string;
  league?: string;
  poster?: string;
  starts_at?: number;
  teams?: { home?: { name?: string }; away?: { name?: string } };
  sources?: BrowseSource[];
  embed?: string;
  iframe?: string;
}

interface CuratedItem {
  id: string;
  streamId: string;
  sourceApiId: string | null;
  name: string;
  category: string;
  status: string;
  enabled: boolean;
}

interface ApiChannel {
  id: string;
  name: string;
  embedUrl: string;
  category: string;
  quality: string;
  sampleMatch: string;
  live: boolean;
}

interface ManualChannel {
  id: string;
  name: string;
  category: string;
  streamUrl: string;
  sourceType: string;
  enabled: boolean;
  logo?: string | null;
}

type ViewMode = "matches" | "channels";
type ContentMode = "auto" | "manual";

export function BrowsePanel() {
  const [sources, setSources] = React.useState<ApiSource[]>([]);
  const [selectedSource, setSelectedSource] = React.useState("");
  const [rawStreams, setRawStreams] = React.useState<BrowseStream[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [addedMatchIds, setAddedMatchIds] = React.useState<Set<string>>(new Set());
  const [adding, setAdding] = React.useState<string | null>(null);
  const [curated, setCurated] = React.useState<CuratedItem[]>([]);
  const [view, setView] = React.useState<ViewMode>("matches");
  const [selectedView, setSelectedView] = React.useState<ViewMode>("matches");
  const [contentMode, setContentMode] = React.useState<ContentMode>("auto");
  const [manualChannels, setManualChannels] = React.useState<ManualChannel[]>([]);
  const [addedChannelIds, setAddedChannelIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    fetch("/api/admin/api-sources", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setSources(d.items || []);
        if (d.items?.[0]) setSelectedSource(d.items[0].id);
      });
    fetch("/api/admin/site-config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setContentMode(d.contentMode === "manual" ? "manual" : "auto"));
    refreshCurated();
    refreshChannels();
  }, []);

  function refreshCurated() {
    fetch("/api/admin/curated", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setCurated(d.items || []);
        setAddedMatchIds(new Set((d.items || []).map((i: CuratedItem) => i.streamId)));
      });
  }

  function refreshChannels() {
    fetch("/api/admin/channels", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const items = (d.items || []) as ManualChannel[];
        setManualChannels(items);
        // Channels added from an API (by name) — mark them so the Add
        // button shows "Added".
        setAddedChannelIds(
          new Set(
            items
              .filter((i) => i.sourceType === "curated-api")
              .map((i) => i.name.toLowerCase())
          )
        );
      });
  }

  async function browse(sourceId: string) {
    if (!sourceId) return;
    setLoading(true);
    setError(null);
    setRawStreams([]);
    try {
      const res = await fetch(`/api/admin/browse/${sourceId}`, {
        cache: "no-store",
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Browse failed");
      const all: BrowseStream[] = [];
      for (const cat of d.streams || []) {
        for (const s of cat.streams || []) all.push(s);
      }
      setRawStreams(all);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Browse failed");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (selectedSource) browse(selectedSource);
  }, [selectedSource]);

  async function addMatch(s: BrowseStream) {
    setAdding(`m-${s.id}`);
    try {
      await fetch("/api/admin/curated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceApiId: selectedSource,
          streamId: s.id,
          name: s.name,
          category: s.category_name,
          poster: s.poster ?? null,
          league: s.league ?? null,
          startsAt: s.starts_at ?? null,
          status: s.status,
          teams: s.teams ?? null,
          sources: s.sources ?? null,
          embed: s.embed ?? null,
          iframe: s.iframe ?? null,
        }),
      });
      refreshCurated();
    } finally {
      setAdding(null);
    }
  }

  async function addChannel(ch: ApiChannel) {
    setAdding(`c-${ch.id}`);
    try {
      await fetch("/api/admin/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: ch.name,
          streamUrl: ch.embedUrl,
          category: ch.category,
          sourceType: "curated-api",
        }),
      });
      refreshChannels();
    } finally {
      setAdding(null);
    }
  }

  async function removeCurated(id: string) {
    await fetch(`/api/admin/curated/${id}`, { method: "DELETE" });
    refreshCurated();
  }

  async function toggleCurated(item: CuratedItem) {
    await fetch(`/api/admin/curated/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !item.enabled }),
    });
    refreshCurated();
  }

  async function removeChannel(id: string) {
    await fetch(`/api/admin/channels/${id}`, { method: "DELETE" });
    refreshChannels();
  }

  async function switchMode(mode: ContentMode) {
    setContentMode(mode);
    await fetch("/api/admin/site-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentMode: mode }),
    });
  }

  // Derive channels from the browsed API's stream sources.
  const apiChannels: ApiChannel[] = React.useMemo(() => {
    const map = new Map<string, ApiChannel>();
    for (const s of rawStreams) {
      for (const src of s.sources || []) {
        const key = (src.name || "").toLowerCase();
        if (!key) continue;
        const existing = map.get(key);
        if (existing) {
          if (s.status === "live" && !existing.live) {
            existing.live = true;
            existing.embedUrl = src.embed || existing.embedUrl;
            existing.sampleMatch = s.name;
          }
        } else {
          map.set(key, {
            id: key,
            name: src.name || "Channel",
            embedUrl: src.embed || "",
            category: s.category_name || "other",
            quality: src.hd ? "HD" : src.sd ? "SD" : "AUTO",
            sampleMatch: s.name,
            live: s.status === "live",
          });
        }
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => Number(b.live) - Number(a.live) || a.name.localeCompare(b.name)
    );
  }, [rawStreams]);

  const q = search.trim().toLowerCase();
  const filteredStreams = q
    ? rawStreams.filter((s) =>
        [s.name, s.league, s.category_name, s.teams?.home?.name, s.teams?.away?.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    : rawStreams;
  const filteredChannels = q
    ? apiChannels.filter((c) => c.name.toLowerCase().includes(q) || c.category.includes(q))
    : apiChannels;

  const liveCount = filteredStreams.filter((s) => s.status === "live").length;
  const curatedChannels = manualChannels.filter((c) => c.sourceType === "curated-api");

  return (
    <div className="space-y-6">
      {/* Content mode toggle */}
      <PanelCard
        icon={<Zap className="h-5 w-5 text-emerald-accent" />}
        title="Content mode"
        subtitle="Auto: one API's full live & schedule matches. Manual: only matches you pick from any API."
      >
        <div className="grid grid-cols-2 gap-2">
          <ModeOption
            active={contentMode === "auto"}
            onClick={() => switchMode("auto")}
            icon={<Zap className="h-4 w-4" />}
            label="Auto"
            description="Active API's full matches show automatically"
          />
          <ModeOption
            active={contentMode === "manual"}
            onClick={() => switchMode("manual")}
            icon={<Hand className="h-4 w-4" />}
            label="Manual"
            description="Only curated matches you pick from any API"
          />
        </div>
        {contentMode === "auto" && (
          <p className="mt-3 rounded-lg bg-emerald-accent/10 px-3 py-2 text-xs text-emerald-accent">
            Auto mode is on — the active API source&apos;s live &amp; schedule
            matches show on the site. Switch the active source in the{" "}
            <strong>API Sources</strong> tab.
          </p>
        )}
        {contentMode === "manual" && (
          <p className="mt-3 rounded-lg bg-amber-accent/10 px-3 py-2 text-xs text-amber-accent">
            Manual mode is on — only the {curated.length} curated match(es)
            below show on the site (plus all channels). Browse any API and add
            matches below.
          </p>
        )}
      </PanelCard>

      <PanelCard
        icon={<Server className="h-5 w-5 text-emerald-accent" />}
        title="Browse & add from APIs"
        subtitle="Pick any API source, browse its matches or channels, and selectively add what you want."
      >
        {/* Source selector + view toggle + search */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="h-9 rounded-lg border border-black/10 bg-background/60 px-2.5 text-xs outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 dark:border-white/10"
          >
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.active ? " (active)" : ""}
              </option>
            ))}
          </select>
          <div className="inline-flex items-center gap-0.5 rounded-lg bg-white/5 p-0.5 ring-1 ring-black/10 dark:ring-white/10">
            <ViewToggle
              active={view === "matches"}
              onClick={() => setView("matches")}
              icon={<Star className="h-3.5 w-3.5" />}
              label="Matches"
            />
            <ViewToggle
              active={view === "channels"}
              onClick={() => setView("channels")}
              icon={<Tv className="h-3.5 w-3.5" />}
              label="Channels"
            />
          </div>
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Filter ${view}…`}
              className="h-9 w-full rounded-lg border border-black/10 bg-background/60 pl-8 pr-3 text-xs outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 dark:border-white/10"
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {view === "matches"
              ? `${filteredStreams.length} · ${liveCount} live`
              : `${filteredChannels.length} channels`}
          </span>
        </div>

        {loading && (
          <div className="grid place-items-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        {error && (
          <p className="rounded-lg bg-live/10 px-3 py-2 text-xs text-live">{error}</p>
        )}

        {/* Browse list */}
        {!loading && !error && view === "matches" && (
          <div className="spatial-scroll max-h-[26rem] space-y-1.5 overflow-y-auto pr-1">
            {filteredStreams.slice(0, 200).map((s) => {
              const added = addedMatchIds.has(s.id);
              return (
                <BrowseRow
                  key={s.id}
                  poster={s.poster}
                  title={s.name}
                  subtitle={`${s.category_name}${s.league ? ` · ${s.league}` : ""} · ${s.sources?.length || 0} sources`}
                  live={s.status === "live"}
                  added={added}
                  adding={adding === `m-${s.id}`}
                  onAdd={() => addMatch(s)}
                />
              );
            })}
            {filteredStreams.length === 0 && <Empty text="No matches in this source." />}
          </div>
        )}

        {!loading && !error && view === "channels" && (
          <div className="spatial-scroll max-h-[26rem] space-y-1.5 overflow-y-auto pr-1">
            {filteredChannels.slice(0, 200).map((c) => {
              const added = addedChannelIds.has(c.id);
              return (
                <BrowseRow
                  key={c.id}
                  title={c.name}
                  subtitle={`${c.category} · ${c.quality} · from "${c.sampleMatch}"`}
                  live={c.live}
                  added={added}
                  adding={adding === `c-${c.id}`}
                  addLabel="Add channel"
                  onAdd={() => addChannel(c)}
                />
              );
            })}
            {filteredChannels.length === 0 && <Empty text="No channels in this source." />}
          </div>
        )}
      </PanelCard>

      {/* My selections — merged matches + channels with a sub-toggle */}
      <PanelCard
        icon={<Star className="h-5 w-5 text-emerald-accent" />}
        title="My selections"
        subtitle={`${
          selectedView === "matches"
            ? `${curated.length} curated match(es)`
            : `${curatedChannels.length} channel(s)`
        } — click Matches or Channels to switch.`}
      >
        <div className="mb-3 inline-flex items-center gap-0.5 rounded-lg bg-white/5 p-0.5 ring-1 ring-black/10 dark:ring-white/10">
          <ViewToggle
            active={selectedView === "matches"}
            onClick={() => setSelectedView("matches")}
            icon={<Star className="h-3.5 w-3.5" />}
            label={`Matches (${curated.length})`}
          />
          <ViewToggle
            active={selectedView === "channels"}
            onClick={() => setSelectedView("channels")}
            icon={<Tv className="h-3.5 w-3.5" />}
            label={`Channels (${curatedChannels.length})`}
          />
        </div>

        {selectedView === "matches" ? (
          curated.length === 0 ? (
            <Empty text="No curated matches yet. Browse an API above and add some." />
          ) : (
            <div className="space-y-1.5">
              {curated.map((item) => (
                <CuratedRow
                  key={item.id}
                  title={item.name}
                  subtitle={`${item.category} · ${item.status}`}
                  enabled={item.enabled}
                  onToggle={() => toggleCurated(item)}
                  onRemove={() => removeCurated(item.id)}
                />
              ))}
            </div>
          )
        ) : curatedChannels.length === 0 ? (
          <Empty text="No API channels added yet. Browse an API in Channels view and add some." />
        ) : (
          <div className="space-y-1.5">
            {curatedChannels.map((c) => (
              <ChannelEditRow
                key={c.id}
                channel={c}
                onToggle={async () => {
                  await fetch(`/api/admin/channels/${c.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ enabled: !c.enabled }),
                  });
                  refreshChannels();
                }}
                onRemove={() => removeChannel(c.id)}
                onSaveLogo={async (logo) => {
                  await fetch(`/api/admin/channels/${c.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ logo }),
                  });
                  refreshChannels();
                }}
              />
            ))}
          </div>
        )}
      </PanelCard>
    </div>
  );
}


function ModeOption({
  active,
  onClick,
  icon,
  label,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-xl p-3 text-left ring-1 transition-all",
        active
          ? "bg-emerald-accent/10 ring-emerald-accent/40"
          : "bg-white/40 ring-black/5 hover:bg-white/60 dark:bg-white/[0.03] dark:ring-white/8"
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        {icon}
        {label}
        {active && <Check className="h-3.5 w-3.5 text-emerald-accent" />}
      </span>
      <span className="text-[11px] text-muted-foreground">{description}</span>
    </button>
  );
}

function ViewToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function BrowseRow({
  poster,
  title,
  subtitle,
  live,
  added,
  adding,
  addLabel = "Add",
  onAdd,
}: {
  poster?: string;
  title: string;
  subtitle: string;
  live: boolean;
  added: boolean;
  adding: boolean;
  addLabel?: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/40 p-2.5 ring-1 ring-black/5 dark:bg-white/[0.03] dark:ring-white/8">
      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-black/5 dark:bg-white/8">
        {poster ? (
          <img
            src={poster}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
          />
        ) : (
          <Tv className="h-4 w-4 text-muted-foreground" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      {live && (
        <span className="flex items-center gap-1 rounded-md bg-live/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-live">
          <span className="live-dot scale-50" />
          Live
        </span>
      )}
      <button
        type="button"
        onClick={onAdd}
        disabled={added || adding}
        className={cn(
          "flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
          added
            ? "bg-emerald-accent/15 text-emerald-accent"
            : "bg-primary text-primary-foreground hover:scale-[1.02] disabled:opacity-50"
        )}
      >
        {adding ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : added ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Plus className="h-3.5 w-3.5" />
        )}
        {added ? "Added" : addLabel}
      </button>
    </div>
  );
}

function CuratedRow({
  title,
  subtitle,
  enabled,
  onToggle,
  onRemove,
}: {
  title: string;
  subtitle: string;
  enabled: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "flex items-center gap-3 rounded-xl p-2.5 ring-1",
        enabled
          ? "bg-emerald-accent/5 ring-emerald-accent/20"
          : "bg-white/40 ring-black/5 dark:bg-white/[0.03] dark:ring-white/8"
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        title={enabled ? "Hide" : "Show"}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-white/10 hover:text-foreground"
      >
        {enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={onRemove}
        title="Remove"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-live/10 hover:text-live"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

function ChannelEditRow({
  channel,
  onToggle,
  onRemove,
  onSaveLogo,
}: {
  channel: ManualChannel;
  onToggle: () => void;
  onRemove: () => void;
  onSaveLogo: (logo: string) => Promise<void>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [logo, setLogo] = React.useState(channel.logo ?? "");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setLogo(channel.logo ?? "");
  }, [channel.logo]);

  async function save() {
    setSaving(true);
    try {
      await onSaveLogo(logo);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          "flex items-center gap-3 rounded-xl p-2.5 ring-1",
          channel.enabled
            ? "bg-emerald-accent/5 ring-emerald-accent/20"
            : "bg-white/40 ring-black/5 dark:bg-white/[0.03] dark:ring-white/8"
        )}
      >
        {/* Logo preview */}
        <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-black/5 ring-1 ring-black/10 dark:bg-white/8 dark:ring-white/10">
          {channel.logo ? (
            <img
              src={channel.logo}
              alt=""
              className="h-full w-full object-contain"
              onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0")}
            />
          ) : (
            <Tv className="h-4 w-4 text-muted-foreground" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{channel.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {channel.category} · {channel.streamUrl.slice(0, 40)}
          </p>
        </div>
        {/* Pen icon → edit logo */}
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          title="Edit logo"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-white/10 hover:text-emerald-accent"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          title={channel.enabled ? "Hide" : "Show"}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-white/10 hover:text-foreground"
        >
          {channel.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onRemove}
          title="Remove"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-live/10 hover:text-live"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </motion.div>
      {/* Expandable logo edit form */}
      {editing && (
        <div className="mt-1 flex flex-wrap items-center gap-3 rounded-xl bg-background/40 p-3 ring-1 ring-black/10 dark:ring-white/10">
          <LogoUpload value={logo} onChange={setLogo} />
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setLogo(channel.logo ?? "");
                setEditing(false);
              }}
              className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save logo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl bg-white/4 px-4 py-6 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}
