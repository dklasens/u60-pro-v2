"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";

const stats = [
  { value: "1", label: "Process", sub: "vs 44" },
  { value: "~0.8\u00a0MB", label: "Memory", sub: "vs 225\u00a0MB" },
  { value: "143", label: "Endpoints", sub: "REST API" },
  { value: "16", label: "Categories", sub: "Full Coverage" },
];

export function StatsBar() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <div className="border-y border-border bg-bg-elevated py-10 px-6">
      <div
        ref={ref}
        className="mx-auto grid max-w-4xl grid-cols-2 gap-6 text-center md:grid-cols-4"
      >
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: 0.5,
              delay: i * 0.1,
              ease: [0.16, 1, 0.3, 1] as const,
            }}
          >
            <div className="text-xl font-bold tabular-nums text-text">{stat.value}</div>
            <div className="text-xs font-medium uppercase tracking-wider text-text-dim">
              {stat.label}
            </div>
            <div className="mt-0.5 text-[0.6875rem] text-text-dim/60">
              {stat.sub}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
