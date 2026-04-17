"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { featureDetails } from "@/data/feature-details";
import { Badge } from "@/components/ui/Badge";

export function FeatureDetails() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="px-6 py-20" id="deep-dive">
      <div className="mx-auto max-w-6xl">
        <motion.h2
          className="mb-4 text-center font-display text-[1.75rem] font-bold tracking-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
        >
          Feature Deep Dive
        </motion.h2>
        <motion.p
          className="mx-auto mb-12 max-w-2xl text-center text-[0.9375rem] text-text-dim"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{
            duration: 0.5,
            delay: 0.05,
            ease: [0.16, 1, 0.3, 1] as const,
          }}
        >
          How each feature works in practice — from network testing to modem
          diagnostics.
        </motion.p>

        <div
          ref={ref}
          className="grid grid-cols-1 gap-5 md:grid-cols-2"
        >
          {featureDetails.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                className="rounded-xl border border-border bg-bg-card p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{
                  duration: 0.5,
                  delay: i * 0.06,
                  ease: [0.16, 1, 0.3, 1] as const,
                }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-accent/12">
                    <Icon size={20} className="text-accent" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-semibold leading-none">
                      {feature.title}
                    </h3>
                    <Badge>{feature.category}</Badge>
                  </div>
                </div>
                <p className="mb-3 text-[0.8125rem] leading-relaxed text-text-dim">
                  {feature.description}
                </p>
                <div className="rounded-lg bg-bg/60 px-3.5 py-3">
                  <span className="mb-1 block font-mono text-xs font-medium text-accent">
                    How it works
                  </span>
                  <p className="text-[0.8125rem] leading-relaxed text-text-dim">
                    {feature.howItWorks}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
