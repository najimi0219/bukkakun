import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

/**
 * GET /api/client-ip
 *
 * Returns the requester's IP address as seen by the edge layer.
 * Used by the public inquiry form / download page so that the IP we
 * record for audit/abuse purposes comes from the server (and is therefore
 * trustworthy), rather than being faked on the client.
 *
 * On Vercel, `x-forwarded-for` is set to a comma-separated chain of IPs
 * with the original client IP first; `x-real-ip` is a single-value
 * fallback. If neither is present we return an empty string and let
 * the caller decide what to do.
 */
export async function GET(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for");
  const xri = req.headers.get("x-real-ip");
  const ip =
    (xff?.split(",")[0]?.trim() || xri?.trim() || "").toString();

  return NextResponse.json({ ip });
}
