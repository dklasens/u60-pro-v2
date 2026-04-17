"use client";

import { CopyButton } from "./CopyButton";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export function CodeBlock({ code, language, className }: CodeBlockProps) {
  return (
    <div className={cn("relative", className)}>
      <div className="rounded-lg border border-border bg-bg p-3 pr-16">
        {language && (
          <div className="mb-2 font-mono text-[0.625rem] uppercase tracking-wider text-text-dim">
            {language}
          </div>
        )}
        <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-text">
          <code>{code}</code>
        </pre>
      </div>
      <div className="absolute top-2 right-2">
        <CopyButton text={code} />
      </div>
    </div>
  );
}
