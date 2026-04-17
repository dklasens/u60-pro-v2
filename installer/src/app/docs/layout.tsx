import { DocsNav } from "@/components/layout/DocsNav";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-6 pt-24 pb-16">
      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <DocsNav />
        </aside>
        <article className="min-w-0">{children}</article>
      </div>
    </div>
  );
}
