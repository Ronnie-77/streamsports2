"use client";

import { useQuery } from "@tanstack/react-query";
import type { StreamsResponse } from "@/lib/types";

async function fetchStreams(): Promise<StreamsResponse> {
  const res = await fetch("/api/streams", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load streams (${res.status})`);
  }
  const data = (await res.json()) as StreamsResponse;
  if (!data.success) {
    throw new Error("Upstream reported failure");
  }
  return data;
}

/**
 * Fetch live + upcoming streams from our cached proxy.
 * Polls every 75s (the proxy already caches 60s server-side).
 */
export function useStreams() {
  return useQuery<StreamsResponse>({
    queryKey: ["streams"],
    queryFn: fetchStreams,
    refetchInterval: 75_000,
    refetchOnReconnect: true,
  });
}
