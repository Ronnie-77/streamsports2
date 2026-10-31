"use client";

import { motion } from "framer-motion";
import { Flame, CalendarClock, Tv } from "lucide-react";
import { useStreamStore, type ActiveTab } from "@/lib/store";
import { cn } from "@/lib/utils";

const TABS: {
  value: ActiveTab;
  label: string;
  short: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "live",
    label: "Live Matches",
    short: "Live",
    icon: <Flame className="h-5 w-5" />,
  },
  {
    value: "schedule",
    label: "Schedule",
    short: "Schedule",
    icon: <CalendarClock className="h-5 w-5" />,
  },
  {
    value: "channels",
    label: "Channels",
    short: "Channels",
    icon: <Tv className="h-5 w-5" />,
  },
];

export function FloatingTabBar({
  counts,
}: {
  counts: { live: number; schedule: number; channels: number };
}) {
  const { tab, setTab } = useStreamStore();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-2 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
      <motion.nav
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className="glass-strong shadow-spatial-lg pointer-events-auto flex w-full max-w-[calc(100vw-1rem)] items-center justify-between gap-0.5 rounded-2xl p-1.5 ring-1 ring-black/5 dark:ring-white/10 sm:w-auto sm:max-w-none sm:gap-1"
        aria-label="Primary navigation"
      >
        {TABS.map((t) => {
          const active = tab === t.value;
          const count =
            t.value === "live"
              ? counts.live
              : t.value === "schedule"
                ? counts.schedule
                : counts.channels;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              aria-pressed={active}
              className={cn(
                "relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium transition-colors sm:flex-none sm:px-4 sm:text-sm",
                active
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active && (
                <motion.span
                  layoutId="floating-tab-pill"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className={cn(
                    "absolute inset-0 rounded-xl shadow-spatial ring-1 ring-white/20",
                    t.value === "live"
                      ? "bg-gradient-to-br from-live/90 to-live/70"
                      : "bg-gradient-to-br from-primary/90 to-primary/70"
                  )}
                />
              )}
              <span className="relative flex items-center gap-1.5">
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.short}</span>
                <span
                  className={cn(
                    "min-w-[1.25rem] rounded-md px-1 py-0.5 text-[10px] font-semibold tabular-nums text-center",
                    active
                      ? "bg-white/20 text-white"
                      : "bg-black/5 text-muted-foreground dark:bg-white/8"
                  )}
                >
                  {count}
                </span>
              </span>
            </button>
          );
        })}
      </motion.nav>
    </div>
  );
}
