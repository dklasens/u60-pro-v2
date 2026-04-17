import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — OpenU60",
  description: "Privacy policy for the OpenU60 companion app.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-2 font-display text-2xl font-bold">Privacy Policy</h1>
      <p className="mb-8 text-sm text-text-dim">Last updated: March 10, 2026</p>

      <div className="space-y-6 text-sm leading-relaxed text-text-dim">
        <section>
          <h2 className="mb-2 text-base font-semibold text-text">Overview</h2>
          <p>
            OpenU60 is an open-source companion app for the ZTE U60 Pro (MU5250)
            5G mobile router. It communicates exclusively over your local network
            (LAN) with the zte-agent REST API running on your router.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text">
            Data Accessed
          </h2>
          <p className="mb-2">
            The app accesses the following data from your router over your local
            network:
          </p>
          <ul className="list-inside list-disc space-y-1 pl-2">
            <li>Signal information (RSRP, SINR, RSRQ, band, cell ID)</li>
            <li>SMS messages stored on the router&apos;s SIM card</li>
            <li>Network configuration (WiFi, APN, DNS, firewall settings)</li>
            <li>Battery status and thermal information</li>
            <li>Traffic statistics and connected device list</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text">
            Data NOT Collected
          </h2>
          <ul className="list-inside list-disc space-y-1 pl-2">
            <li>No personal data is collected</li>
            <li>No user accounts or registration required</li>
            <li>No analytics or telemetry</li>
            <li>No crash reporting</li>
            <li>No cloud storage or remote servers</li>
            <li>No advertising or tracking</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text">
            Data Storage
          </h2>
          <p>
            All data stays on your local network. The app communicates via HTTP
            with the zte-agent server running on your router at its LAN IP
            address (typically 192.168.0.1:9090). No data is transmitted to any
            external server, cloud service, or third party.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text">
            Third-Party Sharing
          </h2>
          <p>
            No data is shared with any third party. The app has no third-party
            SDKs, no analytics services, and no advertising networks.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text">
            Permissions
          </h2>
          <p className="mb-2">The app requests the following permissions:</p>
          <ul className="list-inside list-disc space-y-1 pl-2">
            <li>
              <strong>iOS:</strong> Local network access — to communicate with
              your router over WiFi
            </li>
            <li>
              <strong>Android:</strong> INTERNET, ACCESS_WIFI_STATE,
              ACCESS_NETWORK_STATE — to communicate with your router over WiFi
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text">
            Open Source
          </h2>
          <p>
            OpenU60 is fully open-source. You can review the complete source code
            on{" "}
            <a
              href="https://github.com/jesther-ai/open-u60-pro"
              className="text-accent hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-text">Contact</h2>
          <p>
            For privacy inquiries, please open an issue on the{" "}
            <a
              href="https://github.com/jesther-ai/open-u60-pro/issues"
              className="text-accent hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub repository
            </a>
            .
          </p>
        </section>

        <section className="border-t border-border pt-6">
          <p className="text-xs">
            OpenU60 is not affiliated with, endorsed by, or sponsored by ZTE
            Corporation. ZTE and U60 Pro are trademarks of ZTE Corporation.
          </p>
        </section>
      </div>
    </div>
  );
}
