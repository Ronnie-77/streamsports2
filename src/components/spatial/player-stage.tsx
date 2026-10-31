"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Play,
  Users,
  Tv,
  ExternalLink,
  Info,
  CheckCircle2,
} from "lucide-react";
import type { FlatStream } from "@/lib/stream-utils";
import {
  getCategoryMeta,
  sourceQualityLabel,
  formatDurationLeft,
  formatCountdown,
  formatStartsAt,
  formatViewers,
} from "@/lib/stream-utils";
import { useStreamStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { VideoPlayer } from "@/components/player/video-player";

export function PlayerStage({ stream }: { stream: FlatStream | null }) {
  const {
    closeStream,
    activeSourceId,
    setActiveSourceId,
  } = useStreamStore();
  const sources = stream?.sources ?? [];

  // Auto-select the best source (HD preferred) when a stream opens.
  React.useEffect(() => {
    if (stream && !activeSourceId) {
      const hd = sources.find((s) => s.hd);
      const pick = hd ?? sources[0];
      if (pick) setActiveSourceId(pick.id);
    }
  }, [stream, activeSourceId, sources, setActiveSourceId]);

  // Scroll the inline stage into view when a stream is opened so the
  // user sees the player appear (no modal popup to grab focus).
  const stageRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (stream && stageRef.current) {
      const t = setTimeout(() => {
        stageRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 80);
      return () => clearTimeout(t);
    }
  }, [stream]);

  React.useEffect(() => {
    if (!stream) {
      const t = setTimeout(() => setActiveSourceId(null), 200);
      return () => clearTimeout(t);
    }
  }, [stream, setActiveSourceId]);

  const activeSource =
    sources.find((s) => s.id === activeSourceId) ?? sources[0];

  return (
    <AnimatePresence>
      {stream && (
        <motion.section
          ref={stageRef}
          initial={{ opacity: 0, y: -16, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -16, height: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 32 }}
          className="mx-auto max-w-7xl scroll-mt-24 px-4 sm:px-6"
          aria-label="Player"
        >
          <PlayerStageInner
            stream={stream}
            sourceName={activeSource?.name}
            embedUrl={activeSource?.embed ?? stream.embed ?? stream.iframe}
            directUrl={
              (activeSource?.playMode === "direct"
                ? activeSource?.directUrl
                : undefined) ??
              (stream.playMode === "direct" ? stream.directUrl : undefined)
            }
            onClose={closeStream}
            onSelectSource={setActiveSourceId}
            activeSourceId={activeSource?.id ?? ""}
            sources={sources}
          />
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function PlayerStageInner({
  stream,
  sourceName,
  embedUrl,
  directUrl,
  onClose,
  onSelectSource,
  activeSourceId,
  sources,
}: {
  stream: FlatStream;
  sourceName?: string;
  embedUrl?: string;
  directUrl?: string;
  onClose: () => void;
  onSelectSource: (id: string) => void;
  activeSourceId: string;
  sources: NonNullable<FlatStream["sources"]>;
}) {
  const meta = getCategoryMeta(stream.category_name);
  const Icon = meta.icon;
  const isLive = stream.status === "live";
  const viewers = formatViewers(stream.viewers);
  const [posterOk, setPosterOk] = React.useState(true);
  const isDirect = !!directUrl;

  const openPlayer = React.useCallback(() => {
    if (!embedUrl) return;
    window.open(embedUrl, "_blank", "noopener,noreferrer");
  }, [embedUrl]);

  return (
    <div className="glass-strong shadow-spatial-lg overflow-hidden rounded-3xl">
      <div className="grid gap-0 lg:grid-cols-[1.4fr_1fr]">
        {/* Player stage */}
        <div
          className="relative aspect-video w-full overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${meta.from}, ${meta.to})`,
          }}
        >
          {stream.poster && posterOk ? (
            <img
              src={stream.poster}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-60"
              onError={() => setPosterOk(false)}
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20" />
          <div className="spatial-grain absolute inset-0 opacity-20" />

          {/* Top row: status (hidden for direct streams — player has its own) + close */}
          {!isDirect && (
            <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
              <div className="flex flex-wrap items-center gap-2">
                {isLive ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-live/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-live-glow backdrop-blur">
                    <span className="live-dot scale-90" />
                    Live
                  </span>
                ) : (
                  <span className="rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
                    Starts {formatCountdown(stream.starts_at)}
                  </span>
                )}
                <span className="flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur">
                  <Icon className="h-3 w-3" />
                  {meta.label}
                </span>
                {sourceName && (
                  <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur">
                    {sourceName}
                  </span>
                )}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close player"
            className="absolute right-3 top-3 z-30 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition-all hover:scale-105 hover:bg-black/70"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Center: inline video player (direct streams) OR play CTA */}
          {isDirect && directUrl ? (
            <div className="absolute inset-0">
              <VideoPlayer
                key={directUrl}
                src={directUrl}
                poster={stream.poster}
                autoPlay
              />
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <button
                type="button"
                onClick={openPlayer}
                disabled={!embedUrl}
                aria-label="Play stream"
                className="group relative grid h-20 w-20 place-items-center rounded-full bg-white/15 backdrop-blur-xl ring-1 ring-white/40 transition-all hover:scale-110 hover:bg-white/25 disabled:opacity-50"
              >
                <span className="absolute inset-0 animate-ping rounded-full bg-white/10" />
                <span className="relative grid h-16 w-16 place-items-center rounded-full bg-white text-black shadow-spatial-lg transition-transform group-hover:scale-110">
                  <Play className="h-7 w-7 translate-x-0.5 fill-current" />
                </span>
              </button>
              <div className="flex flex-col items-center gap-1.5">
                <p className="text-lg font-semibold text-white drop-shadow sm:text-xl">
                  {stream.name}
                </p>
                {stream.league && (
                  <p className="text-xs text-white/75">{stream.league}</p>
                )}
                <button
                  type="button"
                  onClick={openPlayer}
                  disabled={!embedUrl}
                  className="mt-1 flex items-center gap-1.5 rounded-lg bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-black transition-all hover:scale-105 hover:bg-white disabled:opacity-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Play in player
                </button>
              </div>
            </div>
          )}

          {/* Bottom: meta (hidden for direct streams — player has its own controls) */}
          {!isDirect && (
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/85">
                {viewers && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {viewers}
                  </span>
                )}
                {isLive ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {formatDurationLeft(stream.ends_at)}
                  </span>
                ) : (
                  <span>{formatStartsAt(stream.starts_at)}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Side panel: sources + info */}
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              Stream sources
            </h3>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {sources.length} available
            </span>
          </div>

          {sources.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-4 text-sm text-muted-foreground">
              <Info className="h-4 w-4 text-amber-accent" />
              No embeddable sources for this stream right now.
            </div>
          ) : (
            <div className="spatial-scroll flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
              {sources.map((s) => {
                const active = s.id === activeSourceId;
                const quality = sourceQualityLabel(s);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSelectSource(s.id)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm transition-all",
                      active
                        ? "glass-strong shadow-spatial text-foreground ring-1 ring-primary/40"
                        : "glass text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Tv className="h-4 w-4 shrink-0" />
                      <span className="truncate font-medium">{s.name}</span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wider",
                        quality === "HD"
                          ? "bg-emerald-accent/20 text-emerald-accent"
                          : quality === "SD"
                            ? "bg-amber-accent/20 text-amber-accent"
                            : "bg-white/10 text-muted-foreground"
                      )}
                    >
                      {quality}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-auto rounded-xl bg-white/5 px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
            <Info className="mr-1 inline h-3 w-3 text-emerald-accent" />
            {isDirect
              ? "This channel plays directly on the site using the built-in video player (HLS / DASH / MPEG-TS)."
              : "The full HD player opens in a dedicated view. The stream provider protects its player against off-site embedding, so playback runs in the provider's secure player."}
          </div>
        </div>
      </div>
    </div>
  );
}
