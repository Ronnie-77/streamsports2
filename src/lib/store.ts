"use client";

import { create } from "zustand";

export type ActiveTab = "live" | "schedule" | "channels";

interface StreamStore {
  // Top-level navigation
  tab: ActiveTab;
  setTab: (t: ActiveTab) => void;

  // Search (global, applies within live/schedule)
  search: string;
  setSearch: (v: string) => void;

  // Inline player selection (replaces the old modal dialog).
  // Clicking a card sets activeStreamId and the PlayerStage renders inline.
  activeStreamId: string | null;
  openStream: (id: string) => void;
  closeStream: () => void;

  // Source selector inside the PlayerStage
  activeSourceId: string | null;
  setActiveSourceId: (id: string | null) => void;

  // "More sports" expansion (optional sports collapsed by default)
  moreSportsOpen: boolean;
  toggleMoreSports: () => void;
}

export const useStreamStore = create<StreamStore>((set) => ({
  tab: "live",
  setTab: (t) => set({ tab: t }),

  search: "",
  setSearch: (v) => set({ search: v }),

  activeStreamId: null,
  openStream: (id) => set({ activeStreamId: id, activeSourceId: null }),
  closeStream: () => set({ activeStreamId: null, activeSourceId: null }),

  activeSourceId: null,
  setActiveSourceId: (id) => set({ activeSourceId: id }),

  moreSportsOpen: false,
  toggleMoreSports: () => set((s) => ({ moreSportsOpen: !s.moreSportsOpen })),
}));

// Cricket and Football are the "main" sports; everything else is optional.
export const MAIN_SPORTS = ["football", "cricket"];
