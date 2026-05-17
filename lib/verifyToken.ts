import crypto from "node:crypto";

/**
 * HMAC token for the "one-click property status update" emails.
 *
 * Each link in the verification email carries a token that proves it came
 * from us. We use HMAC-SHA256(property_id|status, HMAC_SECRET) so the same
 * property+status always produces the same token — re-clicking just sets
 * the same state again, which is harmless.
 *
 * No expiry: the link is meant to live in the recipient's inbox for as
 * long as the email is around. If the secret is rotated, all outstanding
 * links become invalid (which is the right thing).
 */

function getSecret(): string {
  const s = process.env.HMAC_SECRET;
  if (!s) {
    throw new Error(
      "HMAC_SECRET is not configured. Set it in Vercel env vars."
    );
  }
  return s;
}

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function signPropertyVerify(
  propertyId: string,
  status: string
): string {
  const mac = crypto
    .createHmac("sha256", getSecret())
    .update(`${propertyId}|${status}`)
    .digest();
  return base64UrlEncode(mac);
}

export function verifyPropertyVerify(
  propertyId: string,
  status: string,
  token: string
): boolean {
  if (!token) return false;
  try {
    const expected = signPropertyVerify(propertyId, status);
    // timing-safe compare
    const a = Buffer.from(expected);
    const b = Buffer.from(token);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
