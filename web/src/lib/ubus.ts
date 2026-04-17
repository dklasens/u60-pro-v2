import { hashPassword } from "./crypto";

const ANON = "00000000000000000000000000000000";
let rpcId = 0;

function ubusUrl(gateway: string): string {
  return `http://${gateway}/ubus/?t=${Date.now()}`;
}

export async function rpc(
  gateway: string,
  session: string,
  obj: string,
  method: string,
  params: Record<string, unknown>
): Promise<unknown[]> {
  const url = ubusUrl(gateway);
  const payload = [
    {
      jsonrpc: "2.0",
      id: ++rpcId,
      method: "call",
      params: [session, obj, method, params],
    },
  ];

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  let data = await res.json();
  if (!Array.isArray(data)) data = [data];
  if (data.length === 0) throw new Error("Empty response from router");

  const entry = data[0];
  if (entry.error) {
    throw new Error(`ubus error: ${JSON.stringify(entry.error)}`);
  }
  return entry.result;
}

export async function enableADB(
  gateway: string,
  password: string
): Promise<void> {
  const saltResult = await rpc(
    gateway,
    ANON,
    "zwrt_web",
    "web_login_info",
    {}
  );
  if (!Array.isArray(saltResult) || saltResult.length < 2) {
    throw new Error("Unexpected salt response. Is the gateway IP correct?");
  }
  const info = saltResult[1] as Record<string, string>;
  const salt = info.zte_web_sault || info.salt;
  if (!salt) {
    throw new Error("No salt returned. The router may be unreachable.");
  }

  const hashed = await hashPassword(password, salt);

  const loginResult = await rpc(gateway, ANON, "zwrt_web", "web_login", {
    password: hashed,
  });
  if (!Array.isArray(loginResult) || loginResult.length < 2) {
    throw new Error("Login failed. Check your password and try again.");
  }
  const session = (loginResult[1] as Record<string, string>)
    .ubus_rpc_session;
  if (!session || session === ANON) {
    throw new Error("Login rejected. Wrong password or session expired.");
  }

  const usbResult = await rpc(gateway, session, "zwrt_bsp.usb", "set", {
    mode: "debug",
  });
  if (Array.isArray(usbResult) && usbResult[0] !== 0) {
    throw new Error(
      `USB mode change failed (code\u00a0${usbResult[0]}). Try again.`
    );
  }
}
