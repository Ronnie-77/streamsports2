"use client";

import * as React from "react";
import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, SearchX } from "lucide-react";
import { useStreams } from "@/hooks/use-streams";
import {
  flattenStreams,
  extractChannels,
  isMainSport,
  getCategoryMeta,
  type FlatStream,
} from "@/lib/stream-utils";
import { useStreamStore } from "@/lib/store";

import { SpatialBackground } from "@/components/spatial/spatial-background";
import { Header } from "@/components/spatial/header";
import { Hero } from "@/components/spatial/hero";
import { FloatingTabBar } from "@/components/spatial/floating-tab-bar";
import { PlayerStage } from "@/components/spatial/player-stage";
import { StreamGrid, StreamGridSkeleton } from "@/components/spatial/stream-grid";
import { ChannelCard } from "@/components/spatial/channel-card";
import { EmptyState } from "@/components/spatial/empty-state";
import { Footer } from "@/components/spatial/footer";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;

export default function HomePage() {
  const { data, isFetching, isError, error, refetch } = useStreams();
  const {
    tab,
    search,
    setSearch,
    activeStreamId,
    openStream,
    moreSportsOpen,
    toggleMoreSports,
  } = useStreamStore();
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);

  const flat = useMemo(() => flattenStreams(data?.streams), [data]);

  // Manual/curated-API channels are merged as live streams but they must
  // NOT appear among the live/schedule MATCH cards — channels belong only
  // in the Channels tab. They're tagged with league === "Manual channel".
  const isChannelStream = (s: FlatStream) =>
    s.league === "Manual channel" ||
    (s.sources?.some((src) => src.source === "manual") ?? false);

  const liveAll = useMemo(
    () => flat.filter((s) => s.status === "live" && !isChannelStream(s)),
    [flat]
  );
  const upcomingAll = useMemo(
    () => flat.filter((s) => s.status === "upcoming" && !isChannelStream(s)),
    [flat]
  );
  const channels = useMemo(() => extractChannels(flat), [flat]);

  const counts = {
    live: liveAll.length,
    schedule: upcomingAll.length,
    channels: channels.length,
  };

  // Search filter (applies within live/schedule tabs)
  const q = search.trim().toLowerCase();
  const matchSearch = React.useCallback(
    (s: FlatStream) => {
      if (!q) return true;
      return [
        s.name,
        s.league,
        s.category_name,
        s.tag,
        s.teams?.home?.name,
        s.teams?.away?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    },
    [q]
  );

  // Split a list into main-sport sections + optional-sport bucket.
  const splitBySport = React.useCallback((list: FlatStream[]) => {
    const main: Record<string, FlatStream[]> = {};
    const optional: FlatStream[] = [];
    for (const s of list) {
      if (isMainSport(s.category_name)) {
        (main[s.category_name] ??= []).push(s);
      } else {
        optional.push(s);
      }
    }
    return { main, optional };
  }, []);

  // Build the content list for the active tab (live/schedule).
  const tabList = tab === "live" ? liveAll : upcomingAll;
  const searched = useMemo(
    () => tabList.filter(matchSearch),
    [tabList, matchSearch]
  );
  const { main: mainMatches, optional: optionalMatches } = useMemo(
    () => splitBySport(searched),
    [searched, splitBySport]
  );

  // Order main sections: football first (more matches), then cricket.
  const mainOrder = useMemo(
    () =>
      Object.entries(mainMatches).sort(
        (a, b) => b[1].length - a[1].length
      ),
    [mainMatches]
  );

  const optionalByCategory = useMemo(() => {
    const map: Record<string, FlatStream[]> = {};
    for (const s of optionalMatches) {
      (map[s.category_name] ??= []).push(s);
    }
    return Object.entries(map).sort(
      (a, b) =>
        b[1].filter((s) => s.status === "live").length -
          a[1].filter((s) => s.status === "live").length ||
        b[1].length - a[1].length
    );
  }, [optionalMatches]);

  // Reset pagination on tab/search change.
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [tab, search]);

  const selectedStream = React.useMemo(
    () =>
      activeStreamId
        ? flat.find((s) => s.id === activeStreamId) ?? null
        : null,
    [activeStreamId, flat]
  );

  const totalShown =
    mainOrder.reduce((a, [, v]) => a + v.length, 0) +
    (moreSportsOpen ? optionalMatches.length : 0);

  const searching = !!q;

  return (
    <div className="relative flex min-h-screen flex-col">
      <SpatialBackground />

      <div className="relative z-10 flex flex-1 flex-col">
        <Header
          liveCount={counts.live}
          totalCount={flat.length}
          isFetching={isFetching}
          onRefresh={() => refetch()}
        />

        {tab === "live" && <Hero />}

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-8 pt-8 sm:px-6">
          {/* Inline player (no modal popup) */}
          <div className="mt-6">
            <PlayerStage stream={selectedStream} />
          </div>

          {/* Search hint row */}
          {tab !== "channels" && (
            <div className="mt-6 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {tab === "live" ? "Live right now" : "Upcoming schedule"}
                {searching && (
                  <span className="ml-2 text-foreground">
                    · filtered by{" "}
                    <span className="font-medium">&ldquo;{q}&rdquo;</span>
                  </span>
                )}
              </p>
              {searching && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Clear search
                </button>
              )}
            </div>
          )}

          {/* Content */}
          <div className="mt-5">
            {isError ? (
              <EmptyState
                icon="offline"
                title="Couldn't reach the stream API"
                description={
                  error instanceof Error
                    ? error.message
                    : "Please try again in a moment."
                }
              />
            ) : !data ? (
              <StreamGridSkeleton count={8} />
            ) : tab === "channels" ? (
              <ChannelsView channels={channels} />
            ) : searched.length === 0 ? (
              <EmptyState
                title={
                  searching ? "No matching matches" : "Nothing here right now"
                }
                description={
                  searching
                    ? "Try a different team, league or keyword."
                    : tab === "live"
                      ? "No live matches at the moment — check the Schedule tab for what's coming up."
                      : "The schedule is empty — check back shortly."
                }
              />
            ) : searching ? (
              // When searching, show a single flat grid of all matches.
              <>
                <StreamGrid streams={searched.slice(0, visibleCount)} />
                <LoadMore
                  shown={Math.min(visibleCount, searched.length)}
                  total={searched.length}
                  onLoad={() =>
                    setVisibleCount((c) => c + PAGE_SIZE)
                  }
                />
              </>
            ) : (
              <>
                {mainOrder.map(([sport, list]) => (
                  <SportSection
                    key={sport}
                    sport={sport}
                    streams={list.slice(0, visibleCount)}
                    onCardClick={openStream}
                  />
                ))}
                {optionalMatches.length > 0 && (
                  <MoreSports
                    open={moreSportsOpen}
                    onToggle={toggleMoreSports}
                    total={optionalMatches.length}
                    liveCount={
                      optionalMatches.filter((s) => s.status === "live").length
                    }
                  >
                    {moreSportsOpen &&
                      optionalByCategory.map(([sport, list]) => (
                        <SportSection
                          key={sport}
                          sport={sport}
                          streams={list.slice(0, visibleCount)}
                          onCardClick={openStream}
                          compact
                        />
                      ))}
                  </MoreSports>
                )}
                {mainOrder.length === 0 && optionalMatches.length === 0 && (
                  <EmptyState
                    title="No matches"
                    description="Check the other tab."
                  />
                )}
              </>
            )}
          </div>

          {/* Non-blocking sync indicator */}
          {isFetching && data && (
            <div className="pointer-events-none fixed bottom-5 left-1/2 z-40 -translate-x-1/2">
              <div className="glass shadow-spatial flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] text-muted-foreground">
                <span className="live-dot scale-75" />
                Syncing live schedule…
              </div>
            </div>
          )}
        </main>

        <Footer />
      </div>

      {/* Floating bottom navigation (Live / Schedule / Channels) */}
      <FloatingTabBar counts={counts} />
    </div>
  );
}

function ChannelsView({ channels }: { channels: ReturnType<typeof extractChannels> }) {
  if (channels.length === 0) {
    return (
      <EmptyState
        title="No channels available"
        description="Channel listings will appear here once streams are scheduled."
      />
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {channels.slice(0, 120).map((c, i) => (
        <ChannelCard key={c.id} channel={c} index={i} />
      ))}
    </div>
  );
}

function SportSection({
  sport,
  streams,
  onCardClick,
  compact,
}: {
  sport: string;
  streams: FlatStream[];
  onCardClick: (id: string) => void;
  compact?: boolean;
}) {
  const meta = getCategoryMeta(sport);
  const Icon = meta.icon;
  const liveCount = streams.filter((s) => s.status === "live").length;
  if (streams.length === 0) return null;

  return (
    <section className={cn(compact ? "mt-8" : "mt-8 first:mt-0")}>
      <div className="mb-4 flex items-center gap-3">
        <span
          className="grid h-8 w-8 place-items-center rounded-lg ring-1 ring-white/20"
          style={{
            background: `linear-gradient(135deg, ${meta.from}, ${meta.to})`,
          }}
        >
          <Icon className="h-4 w-4 text-white" />
        </span>
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          {meta.label}
        </h2>
        <span className="rounded-md bg-white/8 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground tabular-nums">
          {streams.length}
        </span>
        {liveCount > 0 && (
          <span className="flex items-center gap-1 rounded-md bg-live/15 px-2 py-0.5 text-[11px] font-semibold text-live tabular-nums">
            <span className="live-dot scale-75" />
            {liveCount} live
          </span>
        )}
      </div>
      <StreamGrid streams={streams} />
    </section>
  );
}

function MoreSports({
  open,
  onToggle,
  total,
  liveCount,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  total: number;
  liveCount: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <button
        type="button"
        onClick={onToggle}
        className="glass shadow-spatial flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left transition-all hover:shadow-spatial-lg"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/8 text-muted-foreground ring-1 ring-white/10">
            <SearchX className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              More sports
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {total} matches across other categories
              {liveCount > 0 && ` · ${liveCount} live`}
            </p>
          </div>
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="pt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function LoadMore({
  shown,
  total,
  onLoad,
}: {
  shown: number;
  total: number;
  onLoad: () => void;
}) {
  if (shown >= total) return null;
  return (
    <div className="mt-8 flex justify-center">
      <button
        type="button"
        onClick={onLoad}
        className="glass shadow-spatial rounded-xl px-6 py-3 text-sm font-medium text-foreground transition-all hover:scale-[1.02] hover:shadow-spatial-lg"
      >
        Load more · {total - shown} remaining
      </button>
    </div>
  );
}
