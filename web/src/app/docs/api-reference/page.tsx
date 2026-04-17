"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { apiCategories, totalEndpoints, totalCategories } from "@/data/api-endpoints";
import { cn } from "@/lib/utils";

export default function APIReferencePage() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 font-display text-2xl font-bold text-wrap-balance">
          API Reference
        </h1>
        <p className="text-text-dim">
          {totalEndpoints} endpoints across {totalCategories} categories. All
          endpoints are served by zte-agent on{" "}
          <code className="rounded bg-bg-card px-1.5 py-0.5 font-mono text-xs text-accent">
            http://192.168.0.1:9090
          </code>
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        {apiCategories.map((cat, i) => (
          <div
            key={cat.name}
            className={
              i < apiCategories.length - 1 ? "border-b border-border" : ""
            }
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
                <p className="mb-3 text-sm text-text-dim">
                  {cat.capabilities}
                </p>
                {cat.endpoints && (
                  <div className="space-y-1">
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
      </div>
    </div>
  );
}
