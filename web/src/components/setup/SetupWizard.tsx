"use client";

import { useState, useCallback, useRef } from "react";
import { enableADB } from "@/lib/ubus";
import { ADBClient } from "@/lib/adb";
import { CopyButton } from "@/components/ui/CopyButton";
import { DeployLog, type LogEntry } from "./DeployLog";
import {
  Wifi,
  Usb,
  Loader2,
  Check,
  AlertCircle,
  Circle,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

const RELEASE_URL =
  "https://github.com/jesther-ai/open-u60-pro/releases/latest/download/zte-agent";
const DROPBEAR_IPK_URL =
  "https://downloads.openwrt.org/releases/23.05.4/targets/armsr/armv8/packages/dropbear_2022.83-1_aarch64_generic.ipk";

const STEP_NAMES = [
  "Connect",
  "Credentials",
  "Enabling",
  "USB",
  "Status",
  "Deploying",
  "Success",
];

interface AuditResult {
  agentBin: boolean;
  agentRunning: boolean;
  agentRc: boolean;
  dropbear: boolean;
  dropbearRunning: boolean;
  dropbearRc: boolean;
  sshKeys: boolean;
}

interface AuditItem {
  key: keyof AuditResult;
  label: string;
  present: boolean;
  actionLabel: string;
}

export function SetupWizard() {
  const [step, setStep] = useState(0);
  const [password, setPassword] = useState("");
  const [agentPassword, setAgentPassword] = useState("");
  const [gateway, setGateway] = useState("192.168.0.1");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

  // Prerequisites checkboxes
  const [preqWifi, setPreqWifi] = useState(false);
  const [preqUsb, setPreqUsb] = useState(false);
  const [preqCellular, setPreqCellular] = useState(false);

  // Feature checkboxes
  const [installAgent, setInstallAgent] = useState(true);
  const [installSSH, setInstallSSH] = useState(false);
  const [generateKey, setGenerateKey] = useState(false);

  // Audit state
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [auditing, setAuditing] = useState(false);

  // ADB client ref (persists across steps)
  const adbRef = useRef<ADBClient | null>(null);

  // SSH key state
  const [privateKeyPem, setPrivateKeyPem] = useState<string | null>(null);

  // Verification result
  const [agentVerified, setAgentVerified] = useState(false);

  // Deploy summary
  const [deployedItems, setDeployedItems] = useState<string[]>([]);
  const [skippedItems, setSkippedItems] = useState<string[]>([]);

  const addLog = useCallback(
    (text: string, state: LogEntry["state"] = "active") => {
      setLogEntries((prev) => [...prev, { text, state }]);
    },
    []
  );

  const finishLastLog = useCallback(() => {
    setLogEntries((prev) => {
      const next = [...prev];
      const last = next.findLastIndex((e) => e.state === "active");
      if (last >= 0) next[last] = { ...next[last], state: "done" };
      return next;
    });
  }, []);

  const errorLastLog = useCallback(() => {
    setLogEntries((prev) => {
      const next = [...prev];
      const last = next.findLastIndex((e) => e.state === "active");
      if (last >= 0) next[last] = { ...next[last], state: "error" };
      return next;
    });
  }, []);

  const handleEnableADB = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password) {
      setError("Please enter your router password.");
      return;
    }
    if (!agentPassword && installAgent) {
      setError("Please enter a password for the agent API.");
      return;
    }

    setLoading(true);
    setStep(2);

    try {
      await enableADB(gateway, password);
      setStep(3);
    } catch (err) {
      setStep(1);
      setError(
        err instanceof Error
          ? err.message
          : "Connection failed. Ensure you are on the router's network."
      );
    } finally {
      setLoading(false);
    }
  };

  const runDeviceAudit = async (adb: ADBClient): Promise<AuditResult> => {
    // Batch all checks into a single shell call for speed
    const script = [
      'test -x /data/zte-agent && echo "AGENT_BIN=1" || echo "AGENT_BIN=0"',
      'pidof zte-agent >/dev/null 2>&1 && echo "AGENT_PID=1" || echo "AGENT_PID=0"',
      'grep -q start_zte_agent /etc/rc.local 2>/dev/null && echo "AGENT_RC=1" || echo "AGENT_RC=0"',
      'test -x /usr/sbin/dropbear && echo "DROPBEAR=1" || echo "DROPBEAR=0"',
      'pidof dropbear >/dev/null 2>&1 && echo "DB_PID=1" || echo "DB_PID=0"',
      'grep -q start_dropbear /etc/rc.local 2>/dev/null && echo "DB_RC=1" || echo "DB_RC=0"',
      'test -s /etc/dropbear/authorized_keys && echo "KEYS=1" || echo "KEYS=0"',
    ].join("; ");

    const output = await adb.shell(script);
    const flags = new Map<string, boolean>();
    for (const line of output.split("\n")) {
      const match = line.match(/^(\w+)=([01])$/);
      if (match) flags.set(match[1], match[2] === "1");
    }

    return {
      agentBin: flags.get("AGENT_BIN") ?? false,
      agentRunning: flags.get("AGENT_PID") ?? false,
      agentRc: flags.get("AGENT_RC") ?? false,
      dropbear: flags.get("DROPBEAR") ?? false,
      dropbearRunning: flags.get("DB_PID") ?? false,
      dropbearRc: flags.get("DB_RC") ?? false,
      sshKeys: flags.get("KEYS") ?? false,
    };
  };

  const handleConnectUSB = async () => {
    setError("");

    if (typeof navigator === "undefined" || !navigator.usb) {
      setError(
        "WebUSB is not supported in this browser. Please use Chrome or Edge."
      );
      return;
    }

    try {
      const adb = new ADBClient();
      // requestDevice opens native picker — loading starts after user selects
      const device = await navigator.usb.requestDevice({
        filters: [
          { classCode: 0xff, subclassCode: 0x42, protocolCode: 0x01 },
        ],
      });
      // User picked a device — show spinner immediately
      setLoading(true);
      await adb.connectDevice(device);
      adbRef.current = adb;

      // Run device audit
      setAuditing(true);
      setLoading(false);
      setStep(4);
      const result = await runDeviceAudit(adb);
      setAudit(result);
      setAuditing(false);
    } catch (err) {
      setLoading(false);
      if (err instanceof Error && err.name === "NotFoundError") return;

      if (
        err instanceof Error &&
        (err.name === "SecurityError" ||
          err.message.includes("claim") ||
          err.message.includes("interface"))
      ) {
        setError(
          "USB device is in use by another program. Run `adb kill-server` in your terminal and try again."
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Could not connect. Ensure ADB is enabled and try replugging the cable."
        );
      }
    }
  };

  const getAuditItems = (): AuditItem[] => {
    if (!audit) return [];
    const items: AuditItem[] = [];

    if (installAgent) {
      items.push({
        key: "agentBin",
        label: "zte-agent binary",
        present: audit.agentBin,
        actionLabel: audit.agentBin ? "Installed" : "Will install",
      });
      items.push({
        key: "agentRc",
        label: "Agent auto-start",
        present: audit.agentRc,
        actionLabel: audit.agentRc ? "Configured" : "Will configure",
      });
      items.push({
        key: "agentRunning",
        label: "Agent running",
        present: audit.agentRunning,
        actionLabel: audit.agentRunning ? "Running" : "Will start",
      });
    }

    if (installSSH) {
      items.push({
        key: "dropbear",
        label: "Dropbear SSH",
        present: audit.dropbear,
        actionLabel: audit.dropbear ? "Installed" : "Will install",
      });
      items.push({
        key: "dropbearRc",
        label: "SSH auto-start",
        present: audit.dropbearRc,
        actionLabel: audit.dropbearRc ? "Configured" : "Will configure",
      });
    }

    if (generateKey) {
      items.push({
        key: "sshKeys",
        label: "SSH keys",
        present: audit.sshKeys,
        actionLabel: audit.sshKeys ? "Configured" : "Will generate",
      });
    }

    return items;
  };

  const handleDeploy = async () => {
    const adb = adbRef.current;
    if (!adb || !audit) return;

    setStep(5);
    setLogEntries([]);
    setError("");
    const deployed: string[] = [];
    const skipped: string[] = [];

    try {
      // --- zte-agent binary ---
      if (installAgent) {
        if (audit.agentBin) {
          addLog("zte-agent already installed", "done");
          skipped.push("zte-agent binary");
        } else {
          addLog("Downloading zte-agent binary...");
          const response = await fetch(RELEASE_URL);
          if (!response.ok)
            throw new Error(`Download failed: HTTP ${response.status}`);
          const binary = new Uint8Array(await response.arrayBuffer());
          finishLastLog();
          addLog(
            `Downloaded ${(binary.length / 1024 / 1024).toFixed(1)} MB`,
            "done"
          );

          addLog("Pushing binary to device...");
          await adb.push(binary, "/data/zte-agent", 33261);
          finishLastLog();
          deployed.push("zte-agent binary");
        }

        // --- Agent boot script & auto-start ---
        if (audit.agentRc) {
          addLog("Auto-start already configured", "done");
          skipped.push("Agent auto-start");
        } else {
          addLog("Creating boot script...");
          const escapedPassword = agentPassword.replace(/'/g, "'\\''");
          const script = `#!/bin/sh\nexport ZTE_AGENT_PASSWORD='${escapedPassword}'\n/data/zte-agent >/dev/null 2>&1 &\n`;
          await adb.shell(
            "cat > /data/local/tmp/start_zte_agent.sh << 'BOOTEOF'\n" +
              script +
              "BOOTEOF"
          );
          await adb.shell("chmod +x /data/local/tmp/start_zte_agent.sh");
          finishLastLog();

          addLog("Configuring auto-start...");
          await adb.shell(
            "grep -q start_zte_agent /etc/rc.local || sed -i '/^exit 0/i sh /data/local/tmp/start_zte_agent.sh' /etc/rc.local"
          );
          finishLastLog();
          deployed.push("Agent auto-start");
        }

        // --- Start agent ---
        if (audit.agentRunning) {
          addLog("Agent already running", "done");
          skipped.push("Agent running");
        } else {
          addLog("Starting agent...");
          await adb.shell("sh /data/local/tmp/start_zte_agent.sh");
          finishLastLog();
          deployed.push("Agent started");
        }
      }

      // --- Dropbear SSH ---
      if (installSSH) {
        if (audit.dropbear) {
          addLog("Dropbear already installed", "done");
          skipped.push("Dropbear SSH");
        } else {
          addLog("Downloading Dropbear SSH...");
          const response = await fetch(DROPBEAR_IPK_URL);
          if (!response.ok)
            throw new Error(`Dropbear download failed: HTTP ${response.status}`);
          const ipk = new Uint8Array(await response.arrayBuffer());
          finishLastLog();

          addLog("Pushing Dropbear to device...");
          await adb.push(ipk, "/tmp/dropbear.ipk", 33188);
          finishLastLog();

          addLog("Installing Dropbear...");
          await adb.shell("opkg install /tmp/dropbear.ipk && rm /tmp/dropbear.ipk");
          finishLastLog();
          deployed.push("Dropbear SSH");
        }

        // Ensure dropbear config dir exists (idempotent)
        await adb.shell("mkdir -p /etc/dropbear && chmod 700 /etc/dropbear");

        // --- Dropbear auto-start ---
        if (audit.dropbearRc) {
          addLog("SSH auto-start already configured", "done");
          skipped.push("SSH auto-start");
        } else {
          addLog("Configuring SSH auto-start...");
          const dbScript = `#!/bin/sh\n/usr/sbin/dropbear -p 2222 -R\n`;
          await adb.shell(
            "cat > /data/local/tmp/start_dropbear.sh << 'BOOTEOF'\n" +
              dbScript +
              "BOOTEOF"
          );
          await adb.shell("chmod +x /data/local/tmp/start_dropbear.sh");
          await adb.shell(
            "grep -q start_dropbear /etc/rc.local || sed -i '/^exit 0/i sh /data/local/tmp/start_dropbear.sh' /etc/rc.local"
          );
          finishLastLog();
          deployed.push("SSH auto-start");
        }

        // Start dropbear if not running
        if (!audit.dropbearRunning) {
          addLog("Starting Dropbear SSH...");
          await adb.shell("sh /data/local/tmp/start_dropbear.sh 2>/dev/null || /usr/sbin/dropbear -p 2222 -R");
          finishLastLog();
          deployed.push("Dropbear started");
        }
      }

      // --- SSH keys ---
      if (generateKey) {
        if (audit.sshKeys) {
          addLog("SSH keys already configured", "done");
          skipped.push("SSH keys");
        } else {
          addLog("Generating SSH key pair...");
          const keyPair = await crypto.subtle.generateKey(
            { name: "Ed25519" } as EcKeyGenParams,
            true,
            ["sign", "verify"]
          );

          // Export private key as PKCS8 PEM
          const privRaw = await crypto.subtle.exportKey(
            "pkcs8",
            keyPair.privateKey
          );
          const privB64 = btoa(
            String.fromCharCode(...new Uint8Array(privRaw))
          );
          const privPem = `-----BEGIN PRIVATE KEY-----\n${privB64.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----\n`;

          // Export public key as SSH format
          // Ed25519 SSH public key: "ssh-ed25519 <base64>"
          const pubRaw = await crypto.subtle.exportKey(
            "raw",
            keyPair.publicKey
          );
          const pubBytes = new Uint8Array(pubRaw);
          // Build SSH wire format: string "ssh-ed25519" + string <32 bytes>
          const keyType = new TextEncoder().encode("ssh-ed25519");
          const wireLen = 4 + keyType.length + 4 + pubBytes.length;
          const wire = new Uint8Array(wireLen);
          const dv = new DataView(wire.buffer);
          let off = 0;
          dv.setUint32(off, keyType.length, false);
          off += 4;
          wire.set(keyType, off);
          off += keyType.length;
          dv.setUint32(off, pubBytes.length, false);
          off += 4;
          wire.set(pubBytes, off);
          const pubB64 = btoa(String.fromCharCode(...wire));
          const sshPubKey = `ssh-ed25519 ${pubB64} open-u60-setup`;

          finishLastLog();

          addLog("Pushing public key to device...");
          await adb.shell(
            `mkdir -p /etc/dropbear && chmod 700 /etc/dropbear && echo '${sshPubKey}' >> /etc/dropbear/authorized_keys`
          );
          finishLastLog();

          setPrivateKeyPem(privPem);
          deployed.push("SSH keys");
        }
      }

      // --- Verify agent ---
      if (installAgent) {
        addLog("Verifying agent...");
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const verifyRes = await fetch(
            `http://${gateway}:9090/api/auth/login`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ password: agentPassword }),
            }
          );
          if (verifyRes.ok) {
            finishLastLog();
            addLog("Agent verified and running!", "done");
            setAgentVerified(true);
          } else {
            throw new Error("not ok");
          }
        } catch {
          finishLastLog();
          addLog(
            `Agent deployed. Open http://${gateway}:9090 to verify.`,
            "done"
          );
          setAgentVerified(false);
        }
      }

      setDeployedItems(deployed);
      setSkippedItems(skipped);
      setStep(6);
    } catch (err) {
      errorLastLog();
      setError(err instanceof Error ? err.message : "Deployment failed.");
    }
  };

  const auditItems = getAuditItems();
  const pendingCount = auditItems.filter((i) => !i.present).length;
  const doneCount = auditItems.filter((i) => i.present).length;
  const allDone = auditItems.length > 0 && pendingCount === 0;

  const endpointUrl = `http://${gateway}:9090`;

  return (
    <div className="mx-auto max-w-md">
      {/* Step dots */}
      <div className="mb-5 flex gap-2">
        {STEP_NAMES.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-2 w-2 rounded-full transition-colors",
              i === step
                ? "bg-accent"
                : i < step
                  ? "bg-success"
                  : "bg-border"
            )}
          />
        ))}
      </div>

      {/* Step 0: Prerequisites */}
      {step === 0 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">Before You Begin</h2>
          <p className="mb-4 text-sm text-text-dim">
            Confirm the following before starting setup.
          </p>

          <div className="mb-4 space-y-2.5 rounded-lg border border-border bg-bg p-3">
            <label className="flex items-start gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={preqWifi}
                onChange={(e) => setPreqWifi(e.target.checked)}
                className="mt-0.5 rounded accent-accent"
              />
              <span>
                Connected to your router&apos;s <strong>WiFi</strong> network
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={preqUsb}
                onChange={(e) => setPreqUsb(e.target.checked)}
                className="mt-0.5 rounded accent-accent"
              />
              <span>
                <strong>USB-C cable</strong> plugged in between router and computer
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={preqCellular}
                onChange={(e) => setPreqCellular(e.target.checked)}
                className="mt-0.5 rounded accent-accent"
              />
              <span>
                Router&apos;s <strong>cellular network</strong> has internet access
              </span>
            </label>
          </div>

          <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-[0.8125rem] text-text-dim">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-warning" />
            <span>
              When ADB is enabled, USB-C internet sharing will be disabled.
              Your computer will only have internet through WiFi for the rest
              of this setup.
            </span>
          </div>

          <button
            onClick={() => setStep(1)}
            disabled={!preqWifi || !preqUsb || !preqCellular}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            I&apos;m Ready
          </button>
        </div>
      )}

      {/* Step 1: Credentials */}
      {step === 1 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">Enter Credentials</h2>
          <p className="mb-4 text-sm text-text-dim">
            Router admin password to enable ADB, and a password for the
            zte-agent API.
          </p>
          <form onSubmit={handleEnableADB} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[0.8125rem] font-medium">
                Router Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin password"
                className="w-full rounded-lg border border-border bg-bg-input px-3 py-2.5 text-sm text-text outline-none transition-colors focus:border-border-focus focus:ring-2 focus:ring-accent/25"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[0.8125rem] font-medium">
                Agent Password
              </label>
              <input
                type="password"
                value={agentPassword}
                onChange={(e) => setAgentPassword(e.target.value)}
                placeholder="Password for zte-agent API"
                className="w-full rounded-lg border border-border bg-bg-input px-3 py-2.5 text-sm text-text outline-none transition-colors focus:border-border-focus focus:ring-2 focus:ring-accent/25"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[0.8125rem] font-medium">
                Gateway IP
              </label>
              <input
                type="text"
                value={gateway}
                onChange={(e) => setGateway(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg-input px-3 py-2.5 text-sm text-text outline-none transition-colors focus:border-border-focus focus:ring-2 focus:ring-accent/25"
                autoComplete="off"
              />
            </div>

            {/* Feature checkboxes */}
            <div className="space-y-2 rounded-lg border border-border bg-bg p-3">
              <p className="text-[0.8125rem] font-medium">Components to install</p>
              <label className="flex items-center gap-2 text-sm text-text-dim">
                <input
                  type="checkbox"
                  checked={installAgent}
                  onChange={(e) => setInstallAgent(e.target.checked)}
                  className="rounded accent-accent"
                />
                Install zte-agent
              </label>
              <label className="flex items-center gap-2 text-sm text-text-dim">
                <input
                  type="checkbox"
                  checked={installSSH}
                  onChange={(e) => {
                    setInstallSSH(e.target.checked);
                    if (!e.target.checked) setGenerateKey(false);
                  }}
                  className="rounded accent-accent"
                />
                Install SSH server (Dropbear)
              </label>
              <label className={cn("flex items-center gap-2 text-sm text-text-dim", !installSSH && "opacity-40")}>
                <input
                  type="checkbox"
                  checked={generateKey}
                  disabled={!installSSH}
                  onChange={(e) => setGenerateKey(e.target.checked)}
                  className="rounded accent-accent"
                />
                Generate SSH key pair
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Enable ADB
            </button>
            <button
              type="button"
              onClick={() => {
                setError("");
                if (installAgent && !agentPassword) {
                  setError("Please enter a password for the agent API.");
                  return;
                }
                setStep(3);
              }}
              className="mt-2 w-full py-2 text-center text-[0.8125rem] text-text-dim transition-colors hover:text-accent"
            >
              Skip &mdash; ADB already enabled
            </button>
          </form>
          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-error/30 bg-error/10 p-3 text-[0.8125rem] text-error">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Enabling */}
      {step === 2 && (
        <div className="text-center">
          <h2 className="mb-2 text-lg font-semibold">Enabling ADB...</h2>
          <p className="mb-4 text-sm text-text-dim">
            Authenticating with your router and switching USB mode. This takes
            a few seconds.
          </p>
          <div className="flex justify-center py-4">
            <Loader2 size={24} className="animate-spin text-accent" />
          </div>
        </div>
      )}

      {/* Step 3: USB */}
      {step === 3 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">Pair USB Device</h2>
          {loading ? (
            <div className="flex flex-col items-center py-8">
              <Loader2 size={24} className="mb-3 animate-spin text-accent" />
              <span className="text-sm text-text-dim">
                Connecting to device...
              </span>
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-text-dim">
                ADB is enabled. Click below to pair with your router via WebUSB.
              </p>
              <div className="mb-4 flex flex-col items-center py-2">
                <Usb size={32} className="mb-2 text-text-dim" />
                <span className="text-center text-[0.8125rem] text-text-dim">
                  A browser prompt will ask you to select the USB device.
                </span>
              </div>

              <div className="mb-4 rounded-lg border border-border bg-bg p-3 text-[0.8125rem] text-text-dim">
                <p className="mb-1.5">
                  If ADB automatically attached to your device, you&apos;ll need to
                  release it first:
                </p>
                <ol className="mb-1.5 list-inside list-decimal space-y-0.5">
                  <li>Open Terminal</li>
                  <li>Run this command:</li>
                </ol>
                <div className="flex items-center justify-between rounded border border-border bg-bg-input px-2.5 py-1.5">
                  <code className="font-mono text-xs text-text">adb kill-server</code>
                  <CopyButton text="adb kill-server" />
                </div>
              </div>

              <button
                onClick={handleConnectUSB}
                className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                Connect Device
              </button>
            </>
          )}
          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-error/30 bg-error/10 p-3 text-[0.8125rem] text-error">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}
          {!loading && typeof navigator !== "undefined" && !navigator.usb && (
            <div className="mt-3 rounded-lg border border-accent/20 bg-accent/5 p-3 text-[0.8125rem] text-text-dim">
              WebUSB is not supported in this browser. Please use Chrome or
              Edge on desktop.
            </div>
          )}
        </div>
      )}

      {/* Step 4: Status (device audit results) */}
      {step === 4 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">Device Status</h2>
          {auditing ? (
            <div className="flex items-center gap-3 py-8 justify-center">
              <Loader2 size={20} className="animate-spin text-accent" />
              <span className="text-sm text-text-dim">Checking device...</span>
            </div>
          ) : audit ? (
            <>
              <p className="mb-4 text-sm text-text-dim">
                {allDone
                  ? "Everything is already up to date!"
                  : "Review what needs to be installed or configured."}
              </p>

              <div className="rounded-lg border border-border bg-bg divide-y divide-border">
                {auditItems.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      {item.present ? (
                        <Check size={16} className="text-success shrink-0" />
                      ) : (
                        <Circle size={16} className="text-warning shrink-0" />
                      )}
                      <span className="text-sm">{item.label}</span>
                    </div>
                    <span
                      className={cn(
                        "text-xs font-medium",
                        item.present ? "text-success" : "text-warning"
                      )}
                    >
                      {item.actionLabel}
                    </span>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-center text-xs text-text-dim">
                {doneCount > 0 && (
                  <span className="text-success">{doneCount} already done</span>
                )}
                {doneCount > 0 && pendingCount > 0 && " · "}
                {pendingCount > 0 && (
                  <span className="text-warning">
                    {pendingCount} action{pendingCount !== 1 ? "s" : ""} pending
                  </span>
                )}
              </p>

              <button
                onClick={allDone ? () => setStep(6) : handleDeploy}
                className="mt-4 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                {allDone ? "Done" : "Continue"}
              </button>
            </>
          ) : null}
          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-error/30 bg-error/10 p-3 text-[0.8125rem] text-error">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>
      )}

      {/* Step 5: Deploying */}
      {step === 5 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">Deploying...</h2>
          <p className="mb-1 text-sm text-text-dim">
            Installing and configuring selected components.
          </p>
          <DeployLog entries={logEntries} />
          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-error/30 bg-error/10 p-3 text-[0.8125rem] text-error">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>
      )}

      {/* Step 6: Success */}
      {step === 6 && (
        <div>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/15">
            <Check size={24} className="text-success" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">Setup Complete!</h2>

          {/* Summary of actions */}
          {(deployedItems.length > 0 || skippedItems.length > 0) && (
            <div className="mb-4 rounded-lg border border-border bg-bg p-3 text-xs space-y-1">
              {deployedItems.map((item) => (
                <div key={item} className="flex items-center gap-2 text-success">
                  <Check size={12} className="shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
              {skippedItems.map((item) => (
                <div key={item} className="flex items-center gap-2 text-text-dim">
                  <Check size={12} className="shrink-0" />
                  <span>{item} (already done)</span>
                </div>
              ))}
            </div>
          )}

          {/* Agent endpoint */}
          {installAgent && (
            <>
              <p className="mb-1 text-[0.8125rem] text-text-dim">
                Agent API endpoint:
              </p>
              <div className="mb-4 flex items-center justify-between rounded-lg border border-border bg-bg px-3 py-2.5">
                <code className="font-mono text-xs text-text">
                  {endpointUrl}
                </code>
                <CopyButton text={endpointUrl} />
              </div>
            </>
          )}

          {/* SSH info */}
          {installSSH && (
            <>
              <p className="mb-1 text-[0.8125rem] text-text-dim">
                SSH access:
              </p>
              <div className="mb-4 flex items-center justify-between rounded-lg border border-border bg-bg px-3 py-2.5">
                <code className="font-mono text-xs text-text">
                  ssh -p 2222 root@{gateway}
                </code>
                <CopyButton text={`ssh -p 2222 root@${gateway}`} />
              </div>
            </>
          )}

          {/* Private key download */}
          {privateKeyPem && (
            <button
              onClick={() => {
                const blob = new Blob([privateKeyPem], {
                  type: "application/x-pem-file",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "open-u60-key";
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-accent bg-accent/10 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/20"
            >
              <Download size={16} />
              Download Private Key
            </button>
          )}

          <hr className="my-4 border-border" />
          <p className="mb-2 text-sm font-semibold">Next steps:</p>
          <p className="text-sm text-text-dim">
            1. Download the companion app for{" "}
            <a
              href="https://github.com/jesther-ai/open-u60-pro/tree/main/mobile/ios"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              iOS
            </a>{" "}
            or{" "}
            <a
              href="https://github.com/jesther-ai/open-u60-pro/tree/main/mobile/android"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Android
            </a>
            .
          </p>
          <p className="text-sm text-text-dim">
            2. Connect to your router&apos;s WiFi and open the app.
          </p>
          <p className="text-sm text-text-dim">
            3. Log in with the agent password you set above.
          </p>
          <p className="mt-3 text-xs text-text-dim">
            Future deploys: <code className="text-text">./deploy.sh</code> over WiFi
          </p>
        </div>
      )}
    </div>
  );
}
