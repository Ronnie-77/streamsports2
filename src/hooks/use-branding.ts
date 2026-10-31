"use client";

import { useQuery } from "@tanstack/react-query";

export interface Branding {
  siteName: string;
  siteLogo: string | null;
}

async function fetchBranding(): Promise<Branding> {
  const res = await fetch("/api/branding", { cache: "no-store" });
  if (!res.ok) return { siteName: "StreamSpatial", siteLogo: null };
  return res.json();
}

/**
 * Read the site-wide branding (name + logo). React Query dedupes so
 * multiple components sharing this hook make a single fetch.
 */
export function useBranding() {
  return useQuery<Branding>({
    queryKey: ["branding"],
    queryFn: fetchBranding,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
