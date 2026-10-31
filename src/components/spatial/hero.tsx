"use client";

import { motion } from "framer-motion";

export function Hero() {
  return (
    <section className="relative z-10 mx-auto max-w-7xl px-4 pt-12 sm:px-6 sm:pt-20">
      <div className="flex flex-col items-center text-center">
        {/* Headline — bold, production-level with deep saturated gradient */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-4xl text-balance text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl"
        >
          <span
            className="gradient-text"
            style={{
              backgroundImage:
                "linear-gradient(135deg, oklch(0.58 0.19 158), oklch(0.52 0.17 150), oklch(0.65 0.16 65))",
              filter: "drop-shadow(0 3px 14px rgba(15, 30, 20, 0.25))",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
            }}
          >
            Watch Live Sports
          </span>
          <br />
          <span className="text-foreground">in Stunning HD</span>
        </motion.h1>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 max-w-lg text-pretty text-lg text-muted-foreground sm:text-xl"
        >
          Football, Cricket, NBA, NFL, UFC & more — all in one place.
        </motion.p>
      </div>
    </section>
  );
}
