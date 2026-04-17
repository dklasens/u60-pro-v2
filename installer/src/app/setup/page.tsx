import type { Metadata } from "next";
import { SetupWizard } from "@/components/setup/SetupWizard";

export const metadata: Metadata = {
  title: "Setup Wizard",
  description:
    "Deploy zte-agent to your ZTE U60 Pro router from your browser using WebUSB.",
};

export default function SetupPage() {
  return (
    <section className="border-y border-border bg-bg-elevated px-6 py-20 pt-28">
      <div className="mx-auto max-w-md">
        <h1 className="mb-8 text-center font-display text-2xl font-bold tracking-tight">
          Deploy Agent
        </h1>
        <div className="rounded-xl border border-border bg-bg-card p-6">
          <SetupWizard />
        </div>
      </div>
    </section>
  );
}
