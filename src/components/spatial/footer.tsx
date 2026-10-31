"use client";

import { Radio, Heart } from "lucide-react";
import { useBranding } from "@/hooks/use-branding";

export function Footer() {
  const { data: branding } = useBranding();
  const siteName = branding?.siteName || "StreamSpatial";
  const siteLogo = branding?.siteLogo || null;
  const year = new Date().getFullYear();
  return (
    <footer className="relative z-10 mt-auto">
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6">
        <div className="glass shadow-spatial rounded-2xl px-6 py-5">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-emerald-accent to-amber-accent">
                {siteLogo ? (
                  <img
                    src={siteLogo}
                    alt=""
                    className="h-full w-full object-contain"
                    onError={(e) =>
                      ((e.target as HTMLImageElement).style.display = "none")
                    }
                  />
                ) : (
                  <Radio className="h-4 w-4 text-white" />
                )}
              </span>
              <div className="flex flex-col leading-tight">
                <span className="gradient-text text-sm font-semibold">
                  {siteName}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Spatial live sports
                </span>
              </div>
            </div>

            <p className="text-center text-[11px] text-muted-foreground">
              Streams provided by a third-party public API. We do not host any
              content. All trademarks belong to their owners.
            </p>

            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>Built with</span>
              <Heart className="h-3 w-3 fill-live text-live" />
              <span>© {year}</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
