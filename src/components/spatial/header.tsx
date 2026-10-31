"use client";

import * as React from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Search, Radio, RefreshCw, X } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { useStreamStore } from "@/lib/store";
import { useBranding } from "@/hooks/use-branding";
import { cn } from "@/lib/utils";

interface HeaderProps {
  liveCount: number;
  totalCount: number;
  isFetching: boolean;
  onRefresh: () => void;
}

export function Header({
  liveCount,
  totalCount,
  isFetching,
  onRefresh,
}: HeaderProps) {
  const { search, setSearch } = useStreamStore();
  const { data: branding } = useBranding();
  const siteName = branding?.siteName || "StreamSpatial";
  const siteLogo = branding?.siteLogo || null;
  const brandingObj = { siteName, siteLogo };
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { scrollY } = useScroll();
  // Header compresses slightly as you scroll for a spatial "settle".
  const headerPad = useTransform(scrollY, [0, 120], [16, 10]);
  const headerBlur = useTransform(
    scrollY,
    [0, 120],
    ["blur(16px) saturate(160%)", "blur(28px) saturate(190%)"]
  );

  // Keyboard shortcut: "/" focuses search.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes(
          (document.activeElement?.tagName || "").toUpperCase()
        )
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <motion.header
      style={{ paddingTop: headerPad, paddingBottom: headerPad }}
      className="sticky top-0 z-50"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div
          style={{ backdropFilter: headerBlur, WebkitBackdropFilter: headerBlur }}
          className={cn(
            "glass-strong shadow-spatial rounded-2xl",
            "flex items-center gap-3 px-3 sm:px-4 py-2.5"
          )}
        >
          {/* Brand mark — name + logo from admin branding */}
          <a
            href="/"
            className="group flex shrink-0 items-center gap-2.5"
            aria-label={`${brandingObj.siteName} home`}
          >
            <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-accent to-amber-accent shadow-spatial">
              {brandingObj.siteLogo ? (
                <img
                  src={brandingObj.siteLogo || undefined}
                  alt=""
                  className="h-full w-full object-contain"
                  onError={(e) =>
                    ((e.target as HTMLImageElement).style.display = "none")
                  }
                />
              ) : (
                <Radio className="h-5 w-5 text-white drop-shadow" />
              )}
              <span className="absolute inset-0 rounded-xl ring-1 ring-white/30" />
            </span>
            <span className="hidden flex-col leading-none sm:flex">
              <span className="text-[15px] font-semibold tracking-tight gradient-text">
                {brandingObj.siteName}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Live Sports · HD
              </span>
            </span>
          </a>

          {/* Search */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search matches, leagues, teams…"
              className={cn(
                "h-10 w-full rounded-xl bg-background/40 pl-9 pr-9 text-sm",
                "border border-black/10 dark:border-white/10 outline-none transition-all",
                "placeholder:text-muted-foreground/70",
                "focus:bg-background/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/15",
                "spatial-scroll"
              )}
              aria-label="Search streams"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <kbd className="absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
                /
              </kbd>
            )}
          </div>

          {/* Live count pill */}
          <div className="hidden items-center gap-2 rounded-xl glass px-3 py-2 md:flex">
            <span className="live-dot" />
            <div className="flex flex-col leading-none">
              <span className="text-[11px] font-semibold text-foreground tabular-nums">
                {liveCount} live
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {totalCount} total
              </span>
            </div>
          </div>

          {/* Refresh */}
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh streams"
            className={cn(
              "relative grid h-10 w-10 place-items-center rounded-full glass shadow-spatial",
              "transition-all hover:scale-105 active:scale-95",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <RefreshCw
              className={cn(
                "h-[18px] w-[18px] transition-transform",
                isFetching && "animate-spin"
              )}
            />
          </button>

          <ThemeToggle />
        </motion.div>
      </div>
    </motion.header>
  );
}
