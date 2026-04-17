"use client";

import { Check, X, Loader2 } from "lucide-react";

export interface LogEntry {
  text: string;
  state: "active" | "done" | "error";
}

interface DeployLogProps {
  entries: LogEntry[];
}

export function DeployLog({ entries }: DeployLogProps) {
  return (
    <div className="mt-4 max-h-56 overflow-y-auto rounded-lg border border-border bg-bg p-3 font-mono text-xs leading-relaxed">
      {entries.map((entry, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 ${
            entry.state === "done"
              ? "text-success"
              : entry.state === "error"
                ? "text-error"
                : "text-text"
          }`}
        >
          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
            {entry.state === "done" ? (
              <Check size={14} />
            ) : entry.state === "error" ? (
              <X size={14} />
            ) : (
              <Loader2 size={12} className="animate-spin" />
            )}
          </span>
          <span>{entry.text}</span>
        </div>
      ))}
    </div>
  );
}
