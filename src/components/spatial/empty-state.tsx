"use client";

import { motion } from "framer-motion";
import { SearchX, WifiOff, Ban } from "lucide-react";

export function EmptyState({
  title = "No streams found",
  description = "Try a different search, category or filter.",
  icon = "search",
}: {
  title?: string;
  description?: string;
  icon?: "search" | "error" | "offline";
}) {
  const Icon =
    icon === "error" ? Ban : icon === "offline" ? WifiOff : SearchX;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass shadow-spatial mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl px-6 py-12 text-center"
    >
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/8 ring-1 ring-white/10">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </span>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </motion.div>
  );
}
