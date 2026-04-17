import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Callout } from "@/components/ui/Callout";

export const metadata: Metadata = {
  title: "Getting Started",
  description: "Set up zte-agent on your ZTE U60 Pro router.",
};

export default function GettingStartedPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 font-display text-2xl font-bold">
          Getting Started
        </h1>
        <p className="text-text-dim">
          Deploy zte-agent to your ZTE U60 Pro router in minutes.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Prerequisites</h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-text-dim">
          <li>ZTE U60 Pro (MU5250) router</li>
          <li>Chrome or Edge browser (for WebUSB setup)</li>
          <li>USB-C cable</li>
          <li>Router admin password</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Option A: Browser Setup (Recommended)
        </h2>
        <p className="mb-3 text-sm text-text-dim">
          The easiest way — no command line needed. Uses WebUSB to deploy the
          agent directly from your browser.
        </p>
        <ol className="list-inside list-decimal space-y-2 text-sm text-text-dim">
          <li>Connect to your router&apos;s WiFi</li>
          <li>
            Open the{" "}
            <Link href="/setup" className="text-accent hover:underline">
              Setup Wizard
            </Link>
          </li>
          <li>Enter your router password and choose an agent password</li>
          <li>Connect USB-C cable when prompted</li>
          <li>Wait for deployment to complete</li>
        </ol>
        <Callout type="info" className="mt-4">
          WebUSB requires Chrome or Edge on desktop. Safari and Firefox are
          not supported.
        </Callout>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Option B: Command Line</h2>
        <p className="mb-3 text-sm text-text-dim">
          For developers who prefer the terminal.
        </p>

        <h3 className="mb-2 text-sm font-semibold">1. Install Rust</h3>
        <CodeBlock
          code={`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`}
          language="bash"
        />

        <h3 className="mb-2 mt-4 text-sm font-semibold">
          2. Add cross-compilation target
        </h3>
        <CodeBlock
          code={`rustup target add aarch64-unknown-linux-musl`}
          language="bash"
        />

        <h3 className="mb-2 mt-4 text-sm font-semibold">
          3. Install musl cross-linker
        </h3>
        <CodeBlock
          code={`# macOS:
brew install filosottile/musl-cross/musl-cross

# Ubuntu/Debian:
sudo apt install musl-tools gcc-aarch64-linux-gnu`}
          language="bash"
        />

        <h3 className="mb-2 mt-4 text-sm font-semibold">
          4. Install ADB
        </h3>
        <CodeBlock
          code={`# macOS:
brew install android-platform-tools

# Ubuntu/Debian:
sudo apt install android-tools-adb`}
          language="bash"
        />

        <h3 className="mb-2 mt-4 text-sm font-semibold">
          5. Build and deploy
        </h3>
        <CodeBlock
          code={`cargo build --release --target aarch64-unknown-linux-musl -p zte-agent
./setup.sh <router-password> <agent-password>`}
          language="bash"
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Connect Mobile App</h2>
        <ol className="list-inside list-decimal space-y-2 text-sm text-text-dim">
          <li>Connect your phone to the router&apos;s WiFi</li>
          <li>Open OpenU60 app</li>
          <li>
            Set agent URL:{" "}
            <code className="rounded bg-bg-card px-1.5 py-0.5 font-mono text-xs text-accent">
              http://192.168.0.1:9090
            </code>
          </li>
          <li>Enter the agent password you set during setup</li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Subsequent Updates
        </h2>
        <p className="mb-3 text-sm text-text-dim">
          After initial setup, deploy updates via SSH:
        </p>
        <CodeBlock code={`./deploy.sh yourpassword`} language="bash" />
      </section>
    </div>
  );
}
