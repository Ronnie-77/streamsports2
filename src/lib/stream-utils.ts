import {
  Trophy,
  Goal,
  CircleDashed,
  Dices,
  Bike,
  Flame,
  Activity,
  Swords,
  Volleyball,
  Award,
  type LucideIcon,
} from "lucide-react";
import type { SVGProps } from "react";
import { CricketBatIcon, FootballBallIcon } from "@/components/icons/sport-icons";
import type { Stream, StreamCategory } from "@/lib/types";

// ---- Category metadata ---------------------------------------------------

export type SportIcon = LucideIcon | ((props: SVGProps<SVGSVGElement> & { className?: string }) => React.ReactElement);

export interface CategoryMeta {
  key: string;
  label: string;
  icon: SportIcon;
  /** tailwind gradient stops used for accent surfaces */
  from: string;
  to: string;
}

export const CATEGORY_MAP: Record<string, CategoryMeta> = {
  football: {
    key: "football",
    label: "Football",
    icon: FootballBallIcon,
    from: "oklch(0.72 0.18 150)",
    to: "oklch(0.6 0.16 170)",
  },
  cricket: {
    key: "cricket",
    label: "Cricket",
    icon: CricketBatIcon,
    from: "oklch(0.72 0.16 160)",
    to: "oklch(0.55 0.12 175)",
  },
  basketball: {
    key: "basketball",
    label: "Basketball",
    icon: CircleDashed,
    from: "oklch(0.78 0.18 60)",
    to: "oklch(0.62 0.2 35)",
  },
  "american-football": {
    key: "american-football",
    label: "NFL",
    icon: Award,
    from: "oklch(0.6 0.22 25)",
    to: "oklch(0.45 0.16 40)",
  },
  "motor-sports": {
    key: "motor-sports",
    label: "Motorsport",
    icon: Bike,
    from: "oklch(0.7 0.16 70)",
    to: "oklch(0.5 0.14 50)",
  },
  hockey: {
    key: "hockey",
    label: "Hockey",
    icon: Activity,
    from: "oklch(0.7 0.14 200)",
    to: "oklch(0.5 0.12 220)",
  },
  fight: {
    key: "fight",
    label: "Fight / MMA",
    icon: Swords,
    from: "oklch(0.65 0.24 25)",
    to: "oklch(0.5 0.2 15)",
  },
  rugby: {
    key: "rugby",
    label: "Rugby",
    icon: Volleyball,
    from: "oklch(0.62 0.18 145)",
    to: "oklch(0.45 0.14 160)",
  },
};

const DEFAULT_CATEGORY: CategoryMeta = {
  key: "other",
  label: "Other Sports",
  icon: Dices,
  from: "oklch(0.7 0.12 175)",
  to: "oklch(0.5 0.1 165)",
};

export function getCategoryMeta(key: string): CategoryMeta {
  return CATEGORY_MAP[key] ?? {
    ...DEFAULT_CATEGORY,
    key,
    label: key
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
  };
}

// ---- Derived data helpers ------------------------------------------------

export interface FlatStream extends Stream {
  categoryId: number;
}

/** Cricket + football are the headline sports; everything else is optional. */
export const MAIN_SPORTS = ["football", "cricket"];

export function isMainSport(category: string): boolean {
  return MAIN_SPORTS.includes(category);
}

/** A TV channel derived from stream sources across the schedule. */
export interface TvChannel {
  id: string;
  name: string;
  quality: "HD" | "SD" | "AUTO";
  category: string;
  /** Channel logo / poster image URL (from the stream's poster, if any). */
  logo?: string;
  liveCount: number;
  upcomingCount: number;
  /** A representative stream id (the first live match on this channel, if any). */
  sampleStreamId: string;
}

/**
 * Extract distinct TV channels from every stream's sources. Clicking a
 * channel opens its first available match (live preferred) in the player.
 *
 * Logo handling: we ONLY use a stream's poster as a channel logo when the
 * stream is a manual/curated channel (source === "manual") — in that case
 * the poster IS the admin-set channel logo. For API match streams the
 * poster is an event banner, NOT channel branding, so those channels get a
 * letter placeholder (see ChannelCard).
 */
export function extractChannels(
  flat: FlatStream[]
): TvChannel[] {
  const map = new Map<string, TvChannel>();
  for (const s of flat) {
    if (!s.sources) continue;
    // Skip curated matches: when the admin adds a match from Browse & Add,
    // only the match itself should show — its source channels must NOT
    // leak into the Channels tab (only explicitly-added channels belong
    // there). Curated matches have an id prefixed with "curated-".
    if (typeof s.id === "string" && s.id.startsWith("curated-")) continue;
    // Manual/curated channels carry an admin-set logo on `poster`.
    const isManualChannel = s.sources.some(
      (src) => src.source === "manual"
    );
    const channelLogo = isManualChannel ? s.poster : undefined;
    for (const src of s.sources) {
      const key = src.name.toLowerCase();
      const existing = map.get(key);
      const q = sourceQualityLabel(src);
      const isLive = s.status === "live";
      if (existing) {
        if (isLive) existing.liveCount += 1;
        else existing.upcomingCount += 1;
        const sampleStream = flat.find(
          (f) => f.id === existing.sampleStreamId
        );
        if (
          isLive &&
          !(sampleStream && sampleStream.status === "live")
        ) {
          existing.sampleStreamId = s.id;
          if (channelLogo) existing.logo = channelLogo;
        } else if (!existing.logo && channelLogo) {
          existing.logo = channelLogo;
        }
      } else {
        map.set(key, {
          id: key,
          name: src.name,
          quality: q as TvChannel["quality"],
          category: s.category_name,
          logo: channelLogo,
          liveCount: isLive ? 1 : 0,
          upcomingCount: isLive ? 0 : 1,
          sampleStreamId: s.id,
        });
      }
    }
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      b.liveCount - a.liveCount ||
      b.upcomingCount - a.upcomingCount ||
      a.name.localeCompare(b.name)
  );
}

/** Flatten categories into a single stream list while keeping category id. */
export function flattenStreams(
  categories: StreamCategory[] | undefined
): FlatStream[] {
  if (!categories) return [];
  const out: FlatStream[] = [];
  for (const cat of categories) {
    for (const s of cat.streams) {
      out.push({ ...s, categoryId: cat.id });
    }
  }
  return out;
}

export interface CategorySummary {
  key: string;
  meta: CategoryMeta;
  count: number;
  liveCount: number;
}

export function summarizeCategories(
  categories: StreamCategory[] | undefined
): CategorySummary[] {
  if (!categories) return [];
  return categories
    .map((c) => {
      const meta = getCategoryMeta(c.category);
      const liveCount = c.streams.filter(
        (s) => s.status === "live"
      ).length;
      return {
        key: c.category,
        meta,
        count: c.streams.length,
        liveCount,
      };
    })
    .sort((a, b) => b.liveCount - a.liveCount || b.count - a.count);
}

// ---- Time helpers --------------------------------------------------------

const NOW_TICKER: { t: number } = { t: 0 };

/** Force re-render consumers via a ticking "now" value. */
export function setNowTick(t: number) {
  NOW_TICKER.t = t;
}
export function getNowTick() {
  return NOW_TICKER.t || Date.now();
}

export function formatCountdown(startsAt: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = startsAt - now;
  if (diff <= 0) return "Starting";
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (d > 0) return `in ${d}d ${h}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}

export function formatDurationLeft(endsAt: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = endsAt - now;
  // For a live stream whose scheduled end has passed, it's still
  // broadcasting — report it as ongoing rather than "Final".
  if (diff <= 0) return "Live";
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export function formatStartsAt(startsAt: number): string {
  const d = new Date(startsAt * 1000);
  return d.toLocaleString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatViewers(n: number | undefined): string {
  if (!n || n <= 0) return "";
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M watching`;
  if (n >= 1_000)
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K watching`;
  return `${n} watching`;
}

// Quality flag for a source.
export function sourceQualityLabel(source: {
  sd?: number;
  hd?: number;
}): string {
  if (source.hd) return "HD";
  if (source.sd) return "SD";
  return "AUTO";
}
