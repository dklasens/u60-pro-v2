"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { Check, X } from "lucide-react";
import { comparisonData } from "@/data/comparison";

export function Comparison() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="border-y border-border bg-bg-elevated px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <motion.h2
          ref={ref}
          className="mb-12 text-center font-display text-[1.75rem] font-bold tracking-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
        >
          Why Use This Instead?
        </motion.h2>

        <motion.div
          className="overflow-hidden rounded-xl border border-border"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] as const }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-card">
                <th className="px-4 py-3 text-left font-medium text-text-dim">
                  &nbsp;
                </th>
                <th className="px-4 py-3 text-left font-mono text-xs font-semibold text-accent">
                  zte-agent
                </th>
                <th className="px-4 py-3 text-left font-mono text-xs font-semibold text-text-dim">
                  ZTE Official
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row, i) => (
                <tr
                  key={row.label}
                  className={i < comparisonData.length - 1 ? "border-b border-border" : ""}
                >
                  <td className="px-4 py-3 font-medium text-text">
                    {row.label}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-success">
                      <Check size={14} />
                      {row.agent}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-error">
                      <X size={14} />
                      {row.official}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        <motion.p
          className="mt-4 text-center text-xs text-text-dim"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          zte-agent provides equivalent API access using{" "}
          <span className="font-semibold text-success">0.35%</span> of the
          memory
        </motion.p>
      </div>
    </section>
  );
}
