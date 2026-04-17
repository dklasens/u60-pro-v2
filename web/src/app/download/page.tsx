import type { Metadata } from "next";
import {
  Download,
  Github,
  Smartphone,
  Terminal,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { CodeBlock } from "@/components/ui/CodeBlock";

export const metadata: Metadata = {
  title: "Download",
  description: "Download zte-agent, companion apps, and source code.",
};

export default function DownloadPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 pt-28 pb-16">
      <h1 className="mb-2 font-display text-2xl font-bold">Download</h1>
      <p className="mb-10 text-text-dim">
        Get the agent binary, companion apps, and source code.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Agent Binary */}
        <Card>
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Download size={20} className="text-accent" />
          </div>
          <h3 className="mb-1 text-base font-semibold">Agent Binary</h3>
          <p className="mb-4 text-sm text-text-dim">
            Pre-built aarch64 binary for the ZTE U60 Pro. Ready to deploy.
          </p>
          <a
            href="https://github.com/jesther-ai/open-u60-pro/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            <Download size={14} />
            Latest Release
          </a>
        </Card>

        {/* Source Code */}
        <Card>
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Github size={20} className="text-accent" />
          </div>
          <h3 className="mb-1 text-base font-semibold">Source Code</h3>
          <p className="mb-4 text-sm text-text-dim">
            Full source for zte-agent, mobile apps, and web tools. MIT
            licensed.
          </p>
          <a
            href="https://github.com/jesther-ai/open-u60-pro"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text transition-colors hover:border-text-dim"
          >
            <Github size={14} />
            View on GitHub
          </a>
        </Card>

        {/* iOS App */}
        <Card>
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Smartphone size={20} className="text-accent" />
          </div>
          <h3 className="mb-1 text-base font-semibold">iOS App</h3>
          <p className="mb-4 text-sm text-text-dim">
            Native SwiftUI companion app for iPhone and iPad.
          </p>
          <div className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-text-dim">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 21.99 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 21.99C7.79 22.03 6.8 20.68 5.96 19.47C4.25 16.99 2.97 12.5 4.7 9.56C5.55 8.08 7.13 7.17 8.82 7.15C10.1 7.13 11.32 8.02 12.11 8.02C12.89 8.02 14.37 6.95 15.92 7.11C16.57 7.14 18.39 7.38 19.56 9.07C19.47 9.13 17.29 10.39 17.31 13.04C17.34 16.18 20.05 17.21 20.08 17.22C20.05 17.29 19.6 18.88 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
            </svg>
            Coming Soon
          </div>
        </Card>

        {/* Android App */}
        <Card>
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Smartphone size={20} className="text-accent" />
          </div>
          <h3 className="mb-1 text-base font-semibold">Android App</h3>
          <p className="mb-4 text-sm text-text-dim">
            Native Jetpack Compose companion app for Android phones.
          </p>
          <div className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-text-dim">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M17.523 2.186a.5.5 0 00-.858.014L14.857 5.87a10.731 10.731 0 00-2.857-.385c-1 0-1.96.136-2.857.386L7.335 2.2a.5.5 0 00-.858-.014.5.5 0 00-.06.438L8.13 6.014C5.792 7.586 4.25 10.09 4.25 12.939v.561h15.5v-.561c0-2.849-1.542-5.353-3.88-6.925l1.713-3.39a.5.5 0 00-.06-.438zM8.75 10.75a.75.75 0 110-1.5.75.75 0 010 1.5zm6.5 0a.75.75 0 110-1.5.75.75 0 010 1.5zM4.25 14h15.5v5a3 3 0 01-3 3H7.25a3 3 0 01-3-3v-5z" />
            </svg>
            Coming Soon
          </div>
        </Card>
      </div>

      {/* Build instructions */}
      <div className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">
          <Terminal size={18} className="mr-2 inline text-accent" />
          Build from Source
        </h2>
        <CodeBlock
          code={`# Clone the repo
git clone https://github.com/jesther-ai/open-u60-pro.git
cd open-u60-pro

# Build the agent
cargo build --release --target aarch64-unknown-linux-musl -p zte-agent

# Deploy to device
./setup.sh <router-password> <agent-password>`}
          language="bash"
        />
      </div>
    </div>
  );
}
