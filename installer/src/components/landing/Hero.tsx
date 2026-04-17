"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative flex min-h-dvh flex-col items-center justify-center px-6 pt-20 pb-12 text-center">
      {/* Radial glow */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-accent/5 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }}
      >
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 font-mono text-xs text-text-dim">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Open Source
        </div>
      </motion.div>

      <motion.h1
        className="mb-4 font-display text-[clamp(2rem,5vw,3.25rem)] font-extrabold leading-[1.15] tracking-tight"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] as const }}
      >
        ZTE U60 Pro{" "}
        <span className="text-accent">Toolkit</span>
      </motion.h1>

      <motion.p
        className="mx-auto mb-8 max-w-xl text-[clamp(0.9375rem,2vw,1.125rem)] leading-relaxed text-text-dim"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] as const }}
      >
        Unlock the full potential of your ZTE U60 Pro 5G mobile router.
        On-device agent, native companion apps, and web-based bootstrap
        tools.
      </motion.p>

      <motion.div
        className="flex flex-wrap justify-center gap-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] as const }}
      >
        <Link
          href="/setup"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover hover:-translate-y-0.5"
        >
          Get Started
          <ArrowRight size={16} />
        </Link>
        <a
          href="https://github.com/jesther-ai/open-u60-pro"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-2.5 text-sm font-semibold text-text transition-all hover:border-text-dim hover:-translate-y-0.5"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
          View on GitHub
        </a>
      </motion.div>

      {/* Bottom gradient line */}
      <div className="absolute bottom-0 left-1/2 h-px w-4/5 max-w-xl -translate-x-1/2 bg-gradient-to-r from-transparent via-border to-transparent" />
    </section>
  );
}
