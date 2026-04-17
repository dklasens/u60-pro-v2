"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { faqData } from "@/data/faq";
import { cn } from "@/lib/utils";

export default function FAQPage() {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 font-display text-2xl font-bold">FAQ</h1>
        <p className="text-text-dim">
          Frequently asked questions about zte-agent and the ZTE U60 Pro
          Toolkit.
        </p>
      </div>

      <div className="space-y-2">
        {faqData.map((item, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-border"
          >
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-bg-card"
            >
              <span className="pr-4 text-sm font-medium text-text">
                {item.question}
              </span>
              <ChevronDown
                size={16}
                className={cn(
                  "shrink-0 text-text-dim transition-transform",
                  expanded === i && "rotate-180"
                )}
              />
            </button>
            {expanded === i && (
              <div className="border-t border-border px-4 py-3">
                <p className="text-sm leading-relaxed text-text-dim">
                  {item.answer}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
