"use client";

import * as React from "react";

interface AdConfig {
  adsEnabled: boolean;
  scriptUrls: string[];
}

/**
 * Reads the admin-controlled ad config and injects the configured
 * external ad scripts into <head> when ads are enabled.
 */
export function AdInjector() {
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/ad-config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: AdConfig) => {
        if (cancelled || !d.adsEnabled) return;
        const urls = Array.isArray(d.scriptUrls) ? d.scriptUrls : [];
        for (const url of urls) {
          if (!url || typeof url !== "string") continue;
          if (
            document.querySelector(
              `script[data-ad-injected][src="${cssEscape(url)}"]`
            )
          )
            continue;
          const s = document.createElement("script");
          s.src = url;
          s.async = true;
          s.setAttribute("data-ad-injected", "true");
          document.head.appendChild(s);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

function cssEscape(s: string): string {
  return s.replace(/["\\]/g, "\\$&");
}
