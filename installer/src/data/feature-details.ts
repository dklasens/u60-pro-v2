import {
  Gauge,
  Wifi,
  MessageSquare,
  MessageSquareShare,
  Signal,
  Radio,
  ShieldCheck,
  Clock,
  Terminal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface FeatureDetail {
  icon: LucideIcon;
  title: string;
  category: string;
  description: string;
  howItWorks: string;
}

export const featureDetails: FeatureDetail[] = [
  {
    icon: Gauge,
    title: "Speed Test",
    category: "Network",
    description:
      "Measure internet throughput directly from the router.",
    howItWorks:
      "The agent connects to speedtest.net servers from the U60 itself. Measures latency, download, and upload — giving you the true WAN speed without WiFi overhead. Results stream to the app in real time.",
  },
  {
    icon: Wifi,
    title: "LAN Speed Test",
    category: "Network",
    description:
      "Test WiFi link quality between your phone and the router.",
    howItWorks:
      "Your phone sends HTTP requests to the agent's /lan-test/* endpoints over WiFi. Measures ping (empty 200), download (agent streams zeros), and upload (phone streams, agent counts bytes). Tests your WiFi link, not WAN.",
  },
  {
    icon: MessageSquare,
    title: "SMS Management",
    category: "Telephony",
    description:
      "Read, send, and delete SMS directly from the companion app.",
    howItWorks:
      "Messages are read and sent via ubus commands on the device. Conversations are grouped by contact number. You can send to any number, delete individual messages, or clear entire threads.",
  },
  {
    icon: MessageSquareShare,
    title: "SMS Forwarding",
    category: "Telephony",
    description:
      "Auto-forward incoming SMS to Telegram, webhooks, and more.",
    howItWorks:
      "The agent listens for the ubus new-SMS event — no polling delay. Incoming messages are matched against rules (sender, keyword, or both). Matches are forwarded to Telegram, webhooks, ntfy, Discord, Slack, or another phone number, with automatic retry on failure.",
  },
  {
    icon: Signal,
    title: "Signal Monitoring",
    category: "Modem",
    description:
      "Real-time RSRP, SINR, and RSRQ readings with cell info.",
    howItWorks:
      "Reads signal metrics from the modem in real time. Shows serving cell info (NR or LTE), EARFCN/ARFCN, PCI, and band number. Neighbor cell scanning is available for finding better towers in your area.",
  },
  {
    icon: Radio,
    title: "Band Locking",
    category: "Modem",
    description:
      "Lock the modem to specific NR or LTE bands and cells.",
    howItWorks:
      "Force the modem onto specific NR or LTE bands. Cell locking by PCI + frequency. Smart Tower Connect (STC) for automatic best-tower selection. Useful for avoiding congested bands or forcing a better tower.",
  },
  {
    icon: ShieldCheck,
    title: "DNS-over-HTTPS",
    category: "Privacy",
    description:
      "Built-in encrypted DNS proxy for all LAN clients.",
    howItWorks:
      "The agent runs a DoH proxy — LAN clients can use 192.168.0.1:9090 as their DNS resolver. Queries are forwarded over HTTPS to Cloudflare or Google. A response cache speeds up repeat lookups and reduces latency.",
  },
  {
    icon: Clock,
    title: "Scheduler",
    category: "Automation",
    description:
      "Schedule any API action as a one-time or recurring job.",
    howItWorks:
      "Create cron-style jobs that call any agent API endpoint. Examples: reboot at 3 AM daily, toggle airplane mode on a schedule, run a speed test every hour. Jobs are persisted to disk and survive reboots.",
  },
  {
    icon: Terminal,
    title: "AT Commands",
    category: "Modem",
    description:
      "Direct AT command interface for advanced modem diagnostics.",
    howItWorks:
      "Send AT commands directly to /dev/at_mdm0. Query IMEI, modem firmware version, detailed signal info, or send custom AT strings. A power-user tool for deep modem diagnostics and configuration.",
  },
];
