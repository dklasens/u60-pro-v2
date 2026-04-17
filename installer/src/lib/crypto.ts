export async function sha256hex(str: string): Promise<string> {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPassword(
  password: string,
  salt: string
): Promise<string> {
  const first = (await sha256hex(password)).toUpperCase();
  return (await sha256hex(first + salt)).toUpperCase();
}
