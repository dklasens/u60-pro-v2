"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home" },
  { href: "/setup", label: "Setup" },
  { href: "/docs", label: "Docs" },
  { href: "/download", label: "Download" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <nav
      className={cn(
        "glass-navbar fixed top-0 left-0 right-0 z-50 h-14",
        scrolled && "scrolled"
      )}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-mono text-[0.9375rem] font-bold text-text"
        >
          open-u60-pro
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "text-[0.8125rem] transition-colors",
                pathname === l.href || pathname.startsWith(l.href + "/")
                  ? "text-text"
                  : "text-text-dim hover:text-text"
              )}
            >
              {l.label}
            </Link>
          ))}
          <a
            href="https://github.com/jesther-ai/open-u60-pro"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="text-text-dim transition-colors hover:text-text"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="text-text-dim md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-border bg-bg px-6 py-4 md:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "block py-2 text-sm",
                pathname === l.href ? "text-text" : "text-text-dim"
              )}
            >
              {l.label}
            </Link>
          ))}
          <a
            href="https://github.com/jesther-ai/open-u60-pro"
            target="_blank"
            rel="noopener noreferrer"
            className="block py-2 text-sm text-text-dim"
          >
            GitHub
          </a>
        </div>
      )}
    </nav>
  );
}
