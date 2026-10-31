"use client";

import { motion } from "framer-motion";
import { Flame, CalendarClock, Tv } from "lucide-react";
import { useStreamStore, type ActiveTab } from "@/lib/store";
import { cn } from "@/lib/utils";

const TABS: {
  value: ActiveTab;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "live", label: "Live Matches", icon: <Flame className="h-4 w-4" /> },
  {
    value: "schedule",
    label: "Schedule",
    icon: <CalendarClock className="h-4 w-4" />,
  },
  { value: "channels", label: "Channels", icon: <Tv className="h-4 w-4" /> },
];

export function TabNav({
  counts,
}: {
  counts: { live: number; schedule: number; channels: number };
}) {
  const { tab, setTab } = useStreamStore();

  return (
    <div className="flex justify-center">
      <div className="glass shadow-spatial inline-flex items-center gap-1 rounded-2xl p-1.5">
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
                "relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors sm:px-5",
                active
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  className={cn(
                    "absolute inset-0 rounded-xl shadow-spatial ring-1 ring-white/20",
                    t.value === "live"
                      ? "bg-gradient-to-br from-live/90 to-live/70"
                      : "bg-gradient-to-br from-primary/90 to-primary/70"
                  )}
                />
              )}
              <span className="relative flex items-center gap-2">
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    active
                      ? "bg-white/20 text-white"
                      : "bg-white/8 text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
