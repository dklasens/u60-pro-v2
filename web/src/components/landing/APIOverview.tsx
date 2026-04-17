"use client";

import { motion, useInView } from "motion/react";
import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ArrowRight } from "lucide-react";
import { apiCategories, totalEndpoints, totalCategories } from "@/data/api-endpoints";
import { cn } from "@/lib/utils";

export function APIOverview() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <section className="border-y border-border bg-bg-elevated px-6 py-20" ref={ref}>
      <div className="mx-auto max-w-4xl">
        <motion.div
          className="mb-12 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
        >
          <h2 className="mb-2 font-display text-[1.75rem] font-bold tracking-tight text-wrap-balance">
            REST API
          </h2>
          <p className="text-sm text-text-dim">
            {totalEndpoints} endpoints across {totalCategories} categories
          </p>
        </motion.div>

        <motion.div
          className="overflow-hidden rounded-xl border border-border"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] as const }}
        >
          {apiCategories.map((cat, i) => (
            <div
              key={cat.name}
              className={i < apiCategories.length - 1 ? "border-b border-border" : ""}
            >
              <button
                onClick={() =>
                  setExpanded(expanded === cat.name ? null : cat.name)
                }
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-text">{cat.name}</span>
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 font-mono text-xs text-accent">
                    {cat.count}
                  </span>
                </div>
                <ChevronDown
                  size={16}
                  className={cn(
                    "text-text-dim transition-transform",
                    expanded === cat.name && "rotate-180"
                  )}
                />
              </button>
              {expanded === cat.name && (
                <div className="border-t border-border bg-bg px-4 py-3">
                  <p className="text-sm text-text-dim">{cat.capabilities}</p>
                  {cat.endpoints && (
                    <div className="mt-3 space-y-1">
                      {cat.endpoints.map((ep) => (
                        <div
                          key={`${ep.method} ${ep.path}`}
                          className="flex items-baseline gap-2 font-mono text-xs"
                        >
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[0.625rem] font-semibold",
                              ep.method === "GET" && "bg-success/10 text-success",
                              ep.method === "POST" && "bg-accent/10 text-accent",
                              ep.method === "PUT" && "bg-warning/10 text-warning",
                              ep.method === "DELETE" && "bg-error/10 text-error"
                            )}
                          >
                            {ep.method}
                          </span>
                          <span className="text-text">{ep.path}</span>
                          <span className="text-text-dim">
                            — {ep.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </motion.div>

        <motion.div
          className="mt-6 text-center"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Link
            href="/docs/api-reference"
            className="inline-flex items-center gap-1.5 text-sm text-accent transition-colors hover:text-accent-hover"
          >
            View full API reference
            <ArrowRight size={14} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
