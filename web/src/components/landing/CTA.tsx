"use client";

import Link from "next/link";
import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";

export function CTA() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="px-6 py-24" ref={ref}>
      <motion.div
        className="mx-auto max-w-2xl text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }}
      >
        <h2 className="mb-4 font-display text-[clamp(1.5rem,4vw,2.5rem)] font-bold tracking-tight">
          Ready to get started?
        </h2>
        <p className="mx-auto mb-8 max-w-md text-text-dim">
          Deploy the agent to your router in minutes — no command line
          required.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/setup"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover hover:-translate-y-0.5"
          >
            Launch Setup Wizard
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-2.5 text-sm font-semibold text-text transition-all hover:border-text-dim hover:-translate-y-0.5"
          >
            Read the Docs
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
