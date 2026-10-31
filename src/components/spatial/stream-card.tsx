"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Users, Play, Tv, CalendarClock } from "lucide-react";
import type { FlatStream } from "@/lib/stream-utils";
import {
  getCategoryMeta,
  formatCountdown,
  formatDurationLeft,
  formatViewers,
} from "@/lib/stream-utils";
import { useStreamStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface StreamCardProps {
  stream: FlatStream;
  index: number;
}

export function StreamCard({ stream, index }: StreamCardProps) {
  const openStream = useStreamStore((s) => s.openStream);
  const isLive = stream.status === "live";
  const meta = getCategoryMeta(stream.category_name);
  const Icon = meta.icon;

  const poster = stream.poster;
  const homeBadge = stream.teams?.home?.badge;
  const awayBadge = stream.teams?.away?.badge;
  const homeName = stream.teams?.home?.name;
  const awayName = stream.teams?.away?.name;
  const sourceCount = stream.sources?.length ?? 0;
  const hasHD = stream.sources?.some((s) => s.hd);
  const viewers = formatViewers(stream.viewers);

  const [imgOk, setImgOk] = React.useState(true);

  return (
    <motion.button
      type="button"
      onClick={() => openStream(stream.id)}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: Math.min(index * 0.012, 0.25),
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.985 }}
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-2xl text-left",
        "glass shadow-spatial transition-shadow duration-300",
        "hover:shadow-spatial-lg",
        isLive && "hover:shadow-live-glow",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
      aria-label={`Open ${stream.name}`}
    >
      {/* Poster area */}
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        {poster && imgOk ? (
          <img
            src={poster}
            alt=""
            loading="lazy"
            onError={() => setImgOk(false)}
            className={cn(
              "h-full w-full object-cover transition-transform duration-700",
              "group-hover:scale-110"
            )}
          />
        ) : (
          <PosterFallback meta={meta} Icon={Icon} />
        )}

        {/* Gradient scrim for legibility */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/45 to-transparent opacity-70" />

        {/* Status badge (top-left) */}
        <div className="absolute left-3 top-3 flex items-center gap-2">
          {isLive ? (
            <span className="flex items-center gap-1.5 rounded-full bg-live/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-live-glow backdrop-blur">
              <span className="live-dot scale-90" />
              Live
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
              <CalendarClock className="h-3 w-3" />
              {formatCountdown(stream.starts_at)}
            </span>
          )}
          {hasHD && (
            <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white backdrop-blur">
              HD
            </span>
          )}
        </div>

        {/* Category chip (top-right) */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur">
          <Icon className="h-3 w-3" />
          {meta.label}
        </div>

        {/* Team badges + title (bottom) */}
        <div className="absolute inset-x-0 bottom-0 p-3">
          {homeName && awayName ? (
            <div className="mb-1.5 flex items-center justify-center gap-2.5">
              <TeamBadge badge={homeBadge} name={homeName} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                vs
              </span>
              <TeamBadge badge={awayBadge} name={awayName} />
            </div>
          ) : null}

          <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-white drop-shadow-sm">
            {stream.name}
          </h3>
          {stream.league && (
            <p className="mt-0.5 line-clamp-1 text-[11px] text-white/70">
              {stream.league}
            </p>
          )}
        </div>

        {/* Hover play affordance */}
        <div className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span
            className={cn(
              "grid h-12 w-12 place-items-center rounded-full backdrop-blur-md",
              isLive
                ? "bg-live/85 text-white shadow-live-glow"
                : "bg-white/85 text-foreground"
            )}
          >
            <Play className="h-5 w-5 translate-x-0.5 fill-current" />
          </span>
        </div>
      </div>

      {/* Footer meta strip */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Tv className="h-3.5 w-3.5" />
            <span className="tabular-nums">{sourceCount}</span>
          </span>
          {viewers && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span className="tabular-nums">{viewers.replace(" watching", "")}</span>
            </span>
          )}
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">
          {isLive ? formatDurationLeft(stream.ends_at) : "Upcoming"}
        </span>
      </div>

      {/* Live edge glow line */}
      {isLive && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-live to-transparent opacity-80"
        />
      )}
    </motion.button>
  );
}

function TeamBadge({ badge, name }: { badge?: string; name: string }) {
  if (badge) {
    return (
      <img
        src={badge}
        alt={name}
        loading="lazy"
        className="h-7 w-7 rounded-full bg-white/20 object-cover ring-1 ring-white/40 backdrop-blur"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <span className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-[10px] font-bold uppercase text-white ring-1 ring-white/30 backdrop-blur">
      {name.charAt(0)}
    </span>
  );
}

function PosterFallback({
  meta,
  Icon,
}: {
  meta: ReturnType<typeof getCategoryMeta>;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className="relative h-full w-full"
      style={{
        background: `linear-gradient(135deg, ${meta.from}, ${meta.to})`,
      }}
    >
      <div className="absolute inset-0 grid place-items-center">
        <Icon className="h-12 w-12 text-white/40" />
      </div>
      <div className="spatial-grain absolute inset-0 opacity-30" />
    </div>
  );
}
