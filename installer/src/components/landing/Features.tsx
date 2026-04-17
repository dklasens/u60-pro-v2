"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { features } from "@/data/features";

export function Features() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="px-6 py-20" id="features">
      <div className="mx-auto max-w-6xl">
        <motion.h2
          className="mb-12 text-center font-display text-[1.75rem] font-bold tracking-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
        >
          What&apos;s Included
        </motion.h2>

        <div
          ref={ref}
          className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                className="rounded-xl border border-border bg-bg-card p-7 transition-all duration-200 hover:-translate-y-0.5 hover:border-text-dim"
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{
                  duration: 0.5,
                  delay: i * 0.08,
                  ease: [0.16, 1, 0.3, 1] as const,
                }}
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] bg-accent/12">
                  <Icon size={20} className="text-accent" />
                </div>
                <h3 className="mb-2 text-base font-semibold">
                  {feature.title}
                </h3>
                <p className="text-[0.8125rem] leading-relaxed text-text-dim">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
