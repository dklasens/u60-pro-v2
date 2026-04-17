"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import Image from "next/image";
import { deviceSpecs, bandInfo } from "@/data/device-specs";

export function DeviceSpecs() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="px-6 py-20" id="device">
      <div className="mx-auto max-w-6xl" ref={ref}>
        <motion.h2
          className="mb-4 text-center font-display text-[1.75rem] font-bold tracking-tight text-wrap-balance"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
        >
          The Hardware
        </motion.h2>
        <motion.p
          className="mx-auto mb-14 max-w-xl text-center text-[0.875rem] text-text-dim text-pretty"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{
            duration: 0.5,
            delay: 0.05,
            ease: [0.16, 1, 0.3, 1] as const,
          }}
        >
          ZTE U60 Pro (MU5250) — a 5G-Advanced portable router with
          Snapdragon X75 and a 10,000&nbsp;mAh battery.
        </motion.p>

        {/* Product image */}
          <motion.div
            className="flex items-center justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: 0.6,
              delay: 0.1,
              ease: [0.16, 1, 0.3, 1] as const,
            }}
          >
            <div className="relative aspect-square w-full max-w-[420px] overflow-hidden rounded-2xl border border-border bg-bg-card">
              <Image
                src="/images/device/hero.jpg"
                alt="ZTE U60 Pro 5G router"
                fill
                className="object-contain p-4"
                sizes="(max-width: 768px) 100vw, 420px"
                priority
              />
            </div>
          </motion.div>

          {/* Specs grid */}
          <div className="mt-10 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {deviceSpecs.map((spec, i) => (
              <motion.div
                key={spec.label}
                className="rounded-xl border border-border bg-bg-card p-4"
                initial={{ opacity: 0, y: 16 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{
                  duration: 0.4,
                  delay: 0.12 + i * 0.04,
                  ease: [0.16, 1, 0.3, 1] as const,
                }}
              >
                <div className="mb-1 text-[0.6875rem] font-medium uppercase tracking-wider text-text-dim">
                  {spec.label}
                </div>
                <div className="text-[0.8125rem] font-semibold">
                  {spec.value}
                </div>
              </motion.div>
            ))}
          </div>

        {/* Band support */}
        <div className="mt-10 grid w-full grid-cols-1 gap-4 md:grid-cols-2">
          {bandInfo.map((band, i) => (
            <motion.div
              key={band.type}
              className="rounded-xl border border-border bg-bg-card p-5"
              initial={{ opacity: 0, y: 16 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.4,
                delay: 0.5 + i * 0.08,
                ease: [0.16, 1, 0.3, 1] as const,
              }}
            >
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent">
                {band.type}
              </div>
              <div className="font-mono text-[0.75rem] leading-relaxed text-text-dim">
                {band.bands}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
