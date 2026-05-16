"use client";

/**
 * DNS auto-detect for the email-sending settings page.
 *
 * Uses Cloudflare's public DNS-over-HTTPS (https://1.1.1.1) which is
 * CORS-enabled, so the browser can call it directly without a backend
 * proxy. We look up:
 *   - NS records  → identify the DNS provider (Cloudflare / お名前.com / etc.)
 *   - MX records  → identify the mail provider (Google Workspace / M365 / etc.)
 *   - TXT records → find any existing SPF record (for merge proposal)
 */

import type {
  DnsProvider,
  MailProvider,
  VerificationDnsRecord,
} from "./types";

const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";

interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

async function doh(name: string, type: "NS" | "MX" | "TXT" | "A"): Promise<DohAnswer[]> {
  const url = DOH_ENDPOINT + "?name=" + encodeURIComponent(name) + "&type=" + type;
  const res = await fetch(url, {
    headers: { Accept: "application/dns-json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("DNS lookup failed: " + res.status);
  const body = await res.json();
  return (body.Answer ?? []) as DohAnswer[];
}

function classifyDnsByNs(nsValues: string[]): DnsProvider {
  const joined = nsValues.join(" ").toLowerCase();
  if (joined.includes(".cloudflare.com")) return "cloudflare";
  if (joined.includes(".onamae.com")) return "onamae";
  if (joined.includes(".muumuu-domain.com")) return "muumuu";
  if (joined.includes("xserver.jp") || joined.includes("xrea.com")) return "xserver";
  if (joined.includes(".sakura.ne.jp") || joined.includes(".sakura.ad.jp")) return "sakura";
  if (joined.includes("googledomains.com") || joined.includes(".google.com"))
    return "google_domains";
  if (joined.includes("awsdns")) return "route53";
  if (joined.includes(".value-domain.com")) return "value_domain";
  if (joined.includes("azure-dns")) return "azure_dns";
  return "unknown";
}

function classifyMailByMx(mxValues: string[]): MailProvider {
  const joined = mxValues.join(" ").toLowerCase();
  if (joined.includes("google.com") || joined.includes("googlemail.com"))
    return "google_workspace";
  if (joined.includes("outlook.com") || joined.includes("protection.outlook"))
    return "microsoft365";
  if (joined.includes("iijmio") || joined.includes("biz.iij.jp") || joined.includes("ix.")) {
    return "ix";
  }
  if (joined.includes(".sakura.ne.jp")) return "sakura";
  if (joined.length === 0) return "unknown";
  return "self_hosted";
}

// Parse a TXT record - DNS-over-HTTPS returns it surrounded by quotes
function unquoteTxt(raw: string): string {
  return raw.replace(/^"|"$/g, "").replace(/" "/g, "");
}

export interface DnsDetectionResult {
  domain: string;
  ns: string[];
  mx: string[];
  txt: string[];
  existingSpf: string | null;
  dnsProvider: DnsProvider;
  mailProvider: MailProvider;
  // True when we know how to write DNS records via API + OAuth (Cloudflare/Route53/etc.)
  apiAutomatable: boolean;
  // True when the apex already has a Resend-include in SPF
  resendInSpf: boolean;
}

export async function detectDomain(rawDomain: string): Promise<DnsDetectionResult> {
  const domain = rawDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!domain || !domain.includes(".")) {
    throw new Error("ドメイン名が不正です");
  }

  const [nsRes, mxRes, txtRes] = await Promise.all([
    doh(domain, "NS").catch(() => []),
    doh(domain, "MX").catch(() => []),
    doh(domain, "TXT").catch(() => []),
  ]);

  const ns = nsRes.map((a) => a.data.replace(/\.$/, ""));
  const mx = mxRes
    .map((a) => a.data.split(" ").slice(-1)[0]?.replace(/\.$/, "") ?? "")
    .filter(Boolean);
  const txt = txtRes.map((a) => unquoteTxt(a.data));
  const existingSpf = txt.find((t) => t.toLowerCase().startsWith("v=spf1")) ?? null;
  const dnsProvider = classifyDnsByNs(ns);
  const mailProvider = classifyMailByMx(mx);
  const apiAutomatable =
    dnsProvider === "cloudflare" ||
    dnsProvider === "google_domains" ||
    dnsProvider === "route53" ||
    dnsProvider === "azure_dns";
  const resendInSpf = (existingSpf ?? "").toLowerCase().includes("_spf.resend.com");

  return {
    domain,
    ns,
    mx,
    txt,
    existingSpf,
    dnsProvider,
    mailProvider,
    apiAutomatable,
    resendInSpf,
  };
}

/**
 * Compose the DNS records the tenant must add for Resend authentication.
 * The DKIM key here is a mock — in production it comes from the Resend API.
 */
export function buildResendDnsRecords(domain: string): VerificationDnsRecord[] {
  const mockDkim =
    "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDEMOHKabukken1ink2example..." +
    "MOCK_KEY_FROM_RESEND_DASHBOARD_REPLACE_IN_PROD";
  return [
    {
      type: "TXT",
      host: domain,
      value: "v=spf1 include:_spf.resend.com ~all",
      purpose: "spf",
      note:
        "既存の SPF レコードがある場合は、上書きせず 1 行にまとめて " +
        "include:_spf.resend.com を追加してください。",
    },
    {
      type: "TXT",
      host: "resend._domainkey." + domain,
      value: mockDkim,
      purpose: "dkim",
      note: "Resend ダッシュボードから発行される公開鍵を貼ってください(本番)。",
    },
    {
      type: "MX",
      host: "send." + domain,
      value: "feedback-smtp.resend.com",
      priority: 10,
      purpose: "return_path",
      note: "バウンスメール処理用。任意ですが推奨。",
    },
  ];
}

/**
 * Build the merged SPF value when an existing SPF is present.
 * Returns null if Resend is already included.
 */
export function mergeSpfWithResend(existing: string | null): string {
  if (!existing) return "v=spf1 include:_spf.resend.com ~all";
  if (existing.toLowerCase().includes("_spf.resend.com")) return existing;
  // Insert `include:_spf.resend.com` just before the final qualifier (`~all` / `-all` / `?all`).
  const match = existing.match(/^(.*?)\s+([~\-?]all)\s*$/i);
  if (match) {
    const head = match[1].trim();
    const tail = match[2];
    return head + " include:_spf.resend.com " + tail;
  }
  return existing.trim() + " include:_spf.resend.com ~all";
}
