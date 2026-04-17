export interface FAQItem {
  question: string;
  answer: string;
}

export const faqData: FAQItem[] = [
  {
    question: "Is this safe for my router?",
    answer:
      "The agent is a user-space process — it doesn't modify firmware or the kernel. It uses the same ubus/AT interfaces that ZTE's own apps use. Destructive actions (factory reset, reboot) require explicit confirmation. The agent can be stopped or removed at any time.",
  },
  {
    question: "Which browsers support the web setup?",
    answer:
      "The WebUSB-based setup wizard requires Chrome or Edge on desktop. Safari, Firefox, and mobile browsers do not support WebUSB. For non-Chrome users, use the CLI setup script instead.",
  },
  {
    question: "Does this work on other ZTE routers?",
    answer:
      "Currently only the ZTE U60 Pro (MU5250) is supported. The ubus API structure may differ on other ZTE models. Contributions for other devices are welcome.",
  },
  {
    question: "How do I update the agent?",
    answer:
      "Run the deploy script again (deploy.sh) or use the web setup wizard. The new binary will replace the old one and the agent will restart automatically.",
  },
  {
    question: "Can I use SSH instead of WebUSB?",
    answer:
      "Yes. The setup script can optionally install Dropbear SSH on the device. After initial setup via USB, subsequent deploys can use SSH over WiFi (port 2222).",
  },
  {
    question: "What if the agent crashes or I want to remove it?",
    answer:
      "The agent auto-restarts on boot via rc.local. To remove it: connect via ADB or SSH, delete /data/zte-agent and /data/local/tmp/start_zte_agent.sh, then remove the rc.local entry. A factory reset will also clean everything.",
  },
  {
    question: "Does the agent need internet access?",
    answer:
      "No. The agent runs entirely on the LAN (port 9090). It never makes outbound connections. The mobile apps connect directly to the agent over WiFi.",
  },
  {
    question: "What about the mobile apps?",
    answer:
      "Native companion apps for iOS (SwiftUI) and Android (Jetpack Compose) are included. They connect directly to the agent over WiFi — no cloud services required. App Store/Play Store releases are coming soon.",
  },
];
