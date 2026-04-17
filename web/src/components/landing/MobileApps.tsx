"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import Image from "next/image";
import { Smartphone, Wifi, Shield, Layout, MessageSquareShare } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

const appFeatures = [
  { icon: Layout, label: "Dashboard with signal cards, WiFi status, battery" },
  { icon: Smartphone, label: "SMS, voice calls, USSD, SIM Toolkit" },
  { icon: Wifi, label: "Band locking, cell locking, network mode" },
  { icon: Shield, label: "Config backup/restore, scheduler, device info" },
  { icon: MessageSquareShare, label: "SMS forwarding to email or webhook" },
];

export function MobileApps() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="px-6 py-20" ref={ref}>
      <div className="mx-auto max-w-6xl">
        <motion.h2
          className="mb-4 text-center font-display text-[1.75rem] font-bold tracking-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
        >
          Mobile Companion Apps
        </motion.h2>
        <motion.p
          className="mx-auto mb-12 max-w-lg text-center text-sm text-text-dim"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] as const }}
        >
          Native apps that connect directly over WiFi — no computer needed.
        </motion.p>

        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Screenshots */}
          <motion.div
            className="flex justify-center gap-4"
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] as const }}
          >
            {["screenshot1.PNG", "screenshot3.png", "screenshot2.PNG"].map(
              (src, i) => (
                <div
                  key={src}
                  className="w-full max-w-[180px] overflow-hidden rounded-2xl border border-border bg-bg-card shadow-2xl"
                >
                  <Image
                    src={`/images/screenshots/${src}`}
                    alt={`App screenshot ${i + 1}`}
                    width={300}
                    height={650}
                    className="h-auto w-full"
                  />
                </div>
              )
            )}
          </motion.div>

          {/* Features + badges */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] as const }}
          >
            <div className="mb-6 flex gap-2">
              <Badge>SwiftUI</Badge>
              <Badge>Jetpack Compose</Badge>
            </div>

            <div className="space-y-4">
              {appFeatures.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.label} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                      <Icon size={16} className="text-accent" />
                    </div>
                    <span className="text-sm text-text-dim">{f.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex gap-3">
              <div className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-xs font-medium text-text-dim">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 21.99 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 21.99C7.79 22.03 6.8 20.68 5.96 19.47C4.25 16.99 2.97 12.5 4.7 9.56C5.55 8.08 7.13 7.17 8.82 7.15C10.1 7.13 11.32 8.02 12.11 8.02C12.89 8.02 14.37 6.95 15.92 7.11C16.57 7.14 18.39 7.38 19.56 9.07C19.47 9.13 17.29 10.39 17.31 13.04C17.34 16.18 20.05 17.21 20.08 17.22C20.05 17.29 19.6 18.88 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
                </svg>
                iOS — Coming Soon
              </div>
              <div className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-xs font-medium text-text-dim">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M17.523 2.186a.5.5 0 00-.858.014L14.857 5.87a10.731 10.731 0 00-2.857-.385c-1 0-1.96.136-2.857.386L7.335 2.2a.5.5 0 00-.858-.014.5.5 0 00-.06.438L8.13 6.014C5.792 7.586 4.25 10.09 4.25 12.939v.561h15.5v-.561c0-2.849-1.542-5.353-3.88-6.925l1.713-3.39a.5.5 0 00-.06-.438zM8.75 10.75a.75.75 0 110-1.5.75.75 0 010 1.5zm6.5 0a.75.75 0 110-1.5.75.75 0 010 1.5zM4.25 14h15.5v5a3 3 0 01-3 3H7.25a3 3 0 01-3-3v-5z" />
                </svg>
                Android — Coming Soon
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
