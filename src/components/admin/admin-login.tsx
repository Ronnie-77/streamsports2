"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Lock, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminLogin({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Login failed");
      }
      onLoggedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="spatial-aurora" aria-hidden />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 28 }}
        className="glass-strong shadow-spatial-lg relative z-10 w-full max-w-sm rounded-3xl p-8"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-accent to-amber-accent shadow-spatial">
            <ShieldCheck className="h-7 w-7 text-white" />
          </span>
          <h1 className="mt-4 text-xl font-semibold text-foreground">
            Admin Panel
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to manage ads, API sources and channels.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              className={cn(
                "h-11 w-full rounded-xl bg-background/50 pl-9 pr-3 text-sm",
                "border border-black/10 dark:border-white/10 outline-none transition-all",
                "placeholder:text-muted-foreground/70",
                "focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              )}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-live/10 px-3 py-2 text-xs text-live">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className={cn(
              "flex h-11 w-full items-center justify-center gap-2 rounded-xl",
              "bg-primary text-primary-foreground font-medium text-sm",
              "transition-all hover:scale-[1.01] disabled:opacity-50"
            )}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          Secure admin access. Contact the site owner if you need credentials.
        </p>
      </motion.div>
    </div>
  );
}
