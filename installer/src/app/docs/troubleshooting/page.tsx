import type { Metadata } from "next";
import { Callout } from "@/components/ui/Callout";
import { CodeBlock } from "@/components/ui/CodeBlock";

export const metadata: Metadata = {
  title: "Troubleshooting",
  description: "Common issues and solutions for zte-agent and WebUSB setup.",
};

export default function TroubleshootingPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 font-display text-2xl font-bold">
          Troubleshooting
        </h1>
        <p className="text-text-dim">
          Common issues and how to resolve them.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          WebUSB Not Available
        </h2>
        <p className="mb-3 text-sm text-text-dim">
          The setup wizard requires WebUSB, which is only supported in
          Chromium-based browsers (Chrome, Edge, Brave, Opera) on desktop.
        </p>
        <Callout type="warning">
          Safari, Firefox, and all mobile browsers do not support WebUSB. Use
          the CLI setup method instead.
        </Callout>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          ADB Device Not Found
        </h2>
        <p className="mb-3 text-sm text-text-dim">
          If the browser doesn&apos;t show your device in the USB picker:
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-text-dim">
          <li>Ensure ADB was enabled successfully (step 2 completed)</li>
          <li>Try a different USB-C cable (some cables are charge-only)</li>
          <li>
            Disconnect and reconnect the USB cable, then try again
          </li>
          <li>On macOS, check System Preferences &gt; Security for USB permissions</li>
          <li>On Linux, you may need udev rules for the device</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          ADB Connection Handshake Failed
        </h2>
        <p className="mb-3 text-sm text-text-dim">
          This usually means ADB mode wasn&apos;t enabled on the router. Go
          back to step 1, verify your router password, and try again. The USB
          mode switch needs to complete before connecting the cable.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Login Failed / Wrong Password
        </h2>
        <p className="mb-3 text-sm text-text-dim">
          The &quot;Router Password&quot; field expects the admin password for your
          router&apos;s web interface (typically accessed at 192.168.0.1). This
          is not the WiFi password.
        </p>
        <Callout type="info">
          If you&apos;ve never changed it, try the default password printed on the
          router&apos;s label.
        </Callout>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Connection Timeout
        </h2>
        <p className="mb-3 text-sm text-text-dim">
          Ensure you are connected to the router&apos;s WiFi or Ethernet.
          The setup wizard communicates directly with the router at the gateway
          IP (default: 192.168.0.1).
        </p>
        <p className="text-sm text-text-dim">
          If you&apos;ve changed the router&apos;s LAN IP, update the
          Gateway IP field in the credentials form.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Agent Not Responding After Deploy
        </h2>
        <p className="mb-3 text-sm text-text-dim">
          If the verify step fails after deployment:
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-text-dim">
          <li>Wait 5-10 seconds and try refreshing</li>
          <li>
            Check if the agent is running via ADB:
          </li>
        </ul>
        <CodeBlock
          code={`adb shell ps | grep zte-agent`}
          language="bash"
          className="mt-2"
        />
        <p className="mt-2 text-sm text-text-dim">
          If the process isn&apos;t running, check the boot script:
        </p>
        <CodeBlock
          code={`adb shell cat /data/local/tmp/start_zte_agent.sh
adb shell sh /data/local/tmp/start_zte_agent.sh`}
          language="bash"
          className="mt-2"
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          CORS Errors
        </h2>
        <p className="text-sm text-text-dim">
          The zte-agent serves with permissive CORS headers by default. If
          you&apos;re seeing CORS errors, ensure you&apos;re connecting to the
          correct IP and port (9090), and that no proxy or VPN is
          interfering.
        </p>
      </section>
    </div>
  );
}
