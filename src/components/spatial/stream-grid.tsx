"use client";

import { StreamCard } from "./stream-card";
import type { FlatStream } from "@/lib/stream-utils";

export function StreamGrid({ streams }: { streams: FlatStream[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {streams.map((s, i) => (
        <StreamCard key={s.id} stream={s} index={i} />
      ))}
    </div>
  );
}

export function StreamGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="glass shadow-spatial overflow-hidden rounded-2xl"
        >
          <div className="aspect-[16/10] w-full animate-pulse bg-white/5" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-2/3 animate-pulse rounded bg-white/8" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
