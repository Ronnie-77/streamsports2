"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Star, Heart, Play, Tv } from "lucide-react";
import type { TvChannel } from "@/lib/stream-utils";
import { getCategoryMeta } from "@/lib/stream-utils";
import { useStreamStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function ChannelCard({
  channel,
  index,
}: {
  channel: TvChannel;
  index: number;
}) {
  const openStream = useStreamStore((s) => s.openStream);
  const meta = getCategoryMeta(channel.category);
  const Icon = meta.icon;
  const hasLive = channel.liveCount > 0;

  const [fav, setFav] = React.useState(false);
  const [liked, setLiked] = React.useState(false);
  const [logoOk, setLogoOk] = React.useState(true);

  return (
    <motion.button
      type="button"
      onClick={() => openStream(channel.sampleStreamId)}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: Math.min(index * 0.008, 0.15),
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "group relative flex w-full flex-col items-center overflow-hidden rounded-xl p-2 text-center",
        "bg-white shadow-spatial ring-1 ring-black/5 transition-shadow duration-200 hover:shadow-spatial-lg",
        "dark:bg-white/[0.04] dark:ring-white/10",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      )}
      aria-label={`Open ${channel.name}`}
    >
      {/* Top action bar: star (favorite) + heart (like) */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-1 py-1">
        <span
          role="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            setFav((v) => !v);
          }}
          className={cn(
            "grid h-5 w-5 place-items-center rounded transition-colors",
            fav
              ? "text-amber-accent"
              : "text-black/20 hover:text-black/40 dark:text-white/25 dark:hover:text-white/50"
          )}
          aria-label="Favorite"
        >
          <Star className={cn("h-3 w-3", fav && "fill-current")} />
        </span>
        <span
          role="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            setLiked((v) => !v);
          }}
          className={cn(
            "grid h-5 w-5 place-items-center rounded transition-colors",
            liked
              ? "text-live"
              : "text-black/20 hover:text-black/40 dark:text-white/25 dark:hover:text-white/50"
          )}
          aria-label="Like"
        >
          <Heart className={cn("h-3 w-3", liked && "fill-current")} />
        </span>
      </div>

      {/* Thumbnail area with centered channel logo (compact 4:3) */}
      <div className="relative mt-4 flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg bg-black/[0.02] dark:bg-white/[0.03]">
        {hasLive && (
          <span className="absolute left-1 top-1 z-10 flex items-center gap-0.5 rounded bg-live/90 px-1 py-0.5 text-[8px] font-bold uppercase leading-none tracking-wider text-white">
            <span className="live-dot scale-50" />
            Live
          </span>
        )}
        {logoOk && channel.logo ? (
          <img
            src={channel.logo}
            alt={channel.name}
            loading="lazy"
            className="max-h-[80%] max-w-[82%] object-contain"
            onError={() => setLogoOk(false)}
          />
        ) : (
          // Clean letter placeholder — NOT the match banner (which is an
          // event image, not channel branding). Uses the channel's initial
          // on a category-tinted tile.
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white ring-1 ring-black/5 dark:ring-white/10"
            style={{
              background: `linear-gradient(135deg, ${meta.from}, ${meta.to})`,
            }}
          >
            {channel.name.charAt(0).toUpperCase()}
          </span>
        )}
        {/* Hover play overlay */}
        <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/35 group-hover:opacity-100">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-black shadow-spatial-lg">
            <Play className="h-3.5 w-3.5 translate-x-0.5 fill-current" />
          </span>
        </span>
      </div>

      {/* Channel name (bold, centered) */}
      <h3 className="mt-1.5 line-clamp-1 w-full text-center text-[12px] font-bold leading-tight text-foreground">
        {channel.name}
      </h3>

      {/* Category / meta (gray, centered) */}
      <p className="mt-0.5 flex w-full items-center justify-center gap-1 text-[10px] text-muted-foreground">
        <Icon className="h-2.5 w-2.5 shrink-0" />
        <span className="line-clamp-1">{meta.label}</span>
      </p>

      {/* Quality badge */}
      <span
        className={cn(
          "mt-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
          channel.quality === "HD"
            ? "bg-emerald-accent/15 text-emerald-accent"
            : channel.quality === "SD"
              ? "bg-amber-accent/15 text-amber-accent"
              : "bg-black/5 text-muted-foreground dark:bg-white/10"
        )}
      >
        {channel.quality}
      </span>
    </motion.button>
  );
}
