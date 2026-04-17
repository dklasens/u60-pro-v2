"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/docs/getting-started", label: "Getting Started" },
  { href: "/docs/api-reference", label: "API Reference" },
  { href: "/docs/troubleshooting", label: "Troubleshooting" },
  { href: "/docs/faq", label: "FAQ" },
];

export function DocsNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="mb-4 flex items-center gap-2 text-sm text-text-dim lg:hidden"
      >
        {open ? <X size={16} /> : <Menu size={16} />}
        {open ? "Close" : "Menu"}
      </button>

      <nav
        className={cn(
          "lg:block",
          open ? "block" : "hidden"
        )}
      >
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname === item.href
                    ? "bg-accent/10 font-medium text-accent"
                    : "text-text-dim hover:bg-bg-card hover:text-text"
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
