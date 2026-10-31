"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Megaphone,
  Server,
  Tv,
  LogOut,
  Home,
  Loader2,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminLogin } from "./admin-login";
import { AdsPanel } from "./ads-panel";
import { ApiSourcesPanel } from "./api-sources-panel";
import { ChannelsPanel } from "./channels-panel";
import { BrowsePanel } from "./browse-panel";
import { HomePanel } from "./home-panel";

type Tab = "home" | "ads" | "api" | "browse" | "channels";

const TABS: { value: Tab; label: string; icon: React.ReactNode }[] = [
  { value: "home", label: "Home", icon: <Home className="h-4 w-4" /> },
  { value: "ads", label: "Ads", icon: <Megaphone className="h-4 w-4" /> },
  { value: "api", label: "API Sources", icon: <Server className="h-4 w-4" /> },
  { value: "browse", label: "Browse & Add", icon: <Star className="h-4 w-4" /> },
  { value: "channels", label: "Channels", icon: <Tv className="h-4 w-4" /> },
];

export function AdminShell() {
  const [authed, setAuthed] = React.useState<boolean | null>(null);
  const [tab, setTab] = React.useState<Tab>("home");

  React.useEffect(() => {
    let alive = true;
    fetch("/api/admin/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (alive) setAuthed(!!d.authenticated);
      })
      .catch(() => alive && setAuthed(false));
    return () => {
      alive = false;
    };
  }, []);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
  }

  if (authed === null) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!authed) {
    return <AdminLogin onLoggedIn={() => setAuthed(true)} />;
  }

  return (
    <div className="relative min-h-screen bg-background">
      <div className="spatial-aurora" aria-hidden />
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="glass-strong shadow-spatial mb-6 flex items-center justify-between rounded-2xl px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-accent to-amber-accent shadow-spatial">
              <Tv className="h-5 w-5 text-white" />
            </span>
            <div>
              <h1 className="text-base font-semibold text-foreground">
                Admin Panel
              </h1>
              <p className="text-[11px] text-muted-foreground">
                StreamSpatial control center
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <a
              href="/"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-white/8 hover:text-foreground"
            >
              <Home className="h-3.5 w-3.5" /> View site
            </a>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-live/10 hover:text-live"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>

        {/* Tab nav */}
        <div className="glass shadow-spatial mb-6 inline-flex items-center gap-1 rounded-xl p-1.5">
          {TABS.map((t) => {
            const active = tab === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={cn(
                  "relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors sm:px-4",
                  active
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="admin-tab-pill"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/90 to-primary/70 shadow-spatial ring-1 ring-white/20"
                  />
                )}
                <span className="relative flex items-center gap-2">
                  {t.icon}
                  <span className="hidden sm:inline">{t.label}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "home" && <HomePanel />}
          {tab === "ads" && <AdsPanel />}
          {tab === "api" && <ApiSourcesPanel />}
          {tab === "browse" && <BrowsePanel />}
          {tab === "channels" && <ChannelsPanel />}
        </motion.div>
      </div>
    </div>
  );
}
