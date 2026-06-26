import { isIP } from "net";

function isPrivateOrReservedIp(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "0.0.0.0" || ip === "::1") return true;
  if (ip.startsWith("127.") || ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true;
  const parts = ip.split(".").map(Number);
  if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true;
  return false;
}

/** Reject webhook URLs that could reach internal networks (SSRF). */
export function isSafeWebhookUrl(urlString: string): boolean {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "metadata.google.internal"
  ) {
    return false;
  }

  const ipVersion = isIP(host);
  if (ipVersion && isPrivateOrReservedIp(host)) return false;

  return true;
}

export function assertSafeWebhookUrl(urlString: string): void {
  if (!isSafeWebhookUrl(urlString)) {
    throw new Error("Webhook URL must be a public HTTPS endpoint");
  }
}
