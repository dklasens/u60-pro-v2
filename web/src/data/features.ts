import {
  Server,
  Smartphone,
  Globe,
  Signal,
  Radio,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const features: Feature[] = [
  {
    icon: Server,
    title: "On-Device Agent",
    description:
      "Lightweight Rust HTTP server (~0.8 MB RSS) replaces ZTE's 225 MB daemon stack. 143 REST endpoints across 16 categories.",
  },
  {
    icon: Smartphone,
    title: "Mobile Companion Apps",
    description:
      "Native iOS (SwiftUI) and Android (Compose) apps. Dashboard, signal monitor, SMS, band lock, device management — all over WiFi.",
  },
  {
    icon: Globe,
    title: "Web Bootstrap",
    description:
      "Deploy the agent entirely from your browser. WebUSB-powered — no command line needed. Works in Chrome and Edge.",
  },
  {
    icon: Signal,
    title: "Signal Monitoring",
    description:
      "Real-time RSRP, SINR, RSRQ readings. NR/LTE cell info, neighbor cell scanning, and signal quality detection.",
  },
  {
    icon: Radio,
    title: "Band Locking",
    description:
      "Lock to specific NR and LTE bands. Cell locking, STC (Smart Tower Connect), and carrier aggregation control.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy First",
    description:
      "Zero telemetry. No phone-home to ZTE servers. Open-source agent runs on your LAN only. Full control over your device.",
  },
];
