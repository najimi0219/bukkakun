import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  deleteFileFromDrive,
  ensureFreshAccessToken,
} from "@/lib/googleDrive";

export const runtime = "nodejs";

/**
 * POST /api/business-card/delete
 *   { inquiry_id: string }
 *
 * Removes the inquirer's business card and clears the inquiry row's
 * reference. Called from `updateInquiry` when an inquiry transitions
 * into a terminal status (closed / rejected) — we don't want dead leads
 * eating storage.
 *
 * Handles both providers:
 *   - bukkenlink: storage.remove from the business-cards bucket
 *   - gdrive:     proxy delete via tenant's refresh_token
 */
export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const gClientId = process.env.GOOGLE_CLIENT_ID;
  const gClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: "Supabase env vars missing" },
      { status: 500 }
    );
  }

  let body: { inquiry_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const inquiryId = body.inquiry_id;
  if (!inquiryId) {
    return NextResponse.json(
      { ok: false, error: "inquiry_id is required" },
      { status: 400 }
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: inq } = await supabase
    .from("inquiries")
    .select("id, tenant_id, business_card_url, business_card_provider")
    .eq("id", inquiryId)
    .maybeSingle();
  if (!inq) {
    return NextResponse.json({ ok: true, skipped: "no_inquiry" });
  }
  const cardPath = inq.business_card_url as string | null;
  if (!cardPath) {
    return NextResponse.json({ ok: true, skipped: "no_card" });
  }
  const provider = (inq.business_card_provider as string | null) ?? "bukkenlink";

  // Delete the file from its provider.
  if (provider === "gdrive" && gClientId && gClientSecret) {
    try {
      const { data: conn } = await supabase
        .from("storage_connections")
        .select("id, refresh_token, access_token, token_expires_at")
        .eq("tenant_id", inq.tenant_id as string)
        .eq("provider", "gdrive")
        .eq("status", "connected")
        .maybeSingle();
      if (conn?.refresh_token) {
        const fresh = await ensureFreshAccessToken({
          refresh_token: conn.refresh_token as string,
          access_token: (conn.access_token as string | null) ?? null,
          expires_at: conn.token_expires_at
            ? new Date(conn.token_expires_at as string).getTime()
            : null,
          clientId: gClientId,
          clientSecret: gClientSecret,
        });
        if (fresh.refreshed) {
          await supabase
            .from("storage_connections")
            .update({
              access_token: fresh.access_token,
              token_expires_at: new Date(fresh.expires_at).toISOString(),
            })
            .eq("id", conn.id);
        }
        await deleteFileFromDrive({
          accessToken: fresh.access_token,
          fileId: cardPath,
        });
      }
    } catch (e) {
      console.error("[business-card/delete] drive delete failed", e);
      // Continue — we still want to null the inquiry reference so the
      // dangling pointer goes away.
    }
  } else {
    const { error } = await supabase.storage
      .from("business-cards")
      .remove([cardPath]);
    if (error) {
      console.error("[business-card/delete] supabase remove failed", error);
    }
  }

  // Always null the row's reference, even if the underlying delete
  // partially failed — the UI shouldn't keep showing a card we tried to remove.
  await supabase
    .from("inquiries")
    .update({ business_card_url: null, business_card_provider: null })
    .eq("id", inquiryId);

  return NextResponse.json({ ok: true });
}
