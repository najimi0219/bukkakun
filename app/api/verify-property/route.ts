import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPropertyVerify } from "@/lib/verifyToken";

export const runtime = "nodejs";

const VALID_STATUSES = [
  "available",
  "reserved",
  "negotiating",
  "closed",
] as const;

/**
 * GET /api/verify-property?p=<propertyId>&s=<status>&t=<hmac>
 *
 * One-click update endpoint reached from the daily verification email.
 * Validates the HMAC token, updates the property's availability_status +
 * availability_updated_at, and bounces the user to a friendly thank-you
 * page on the property detail.
 *
 * No login required — the HMAC IS the auth. The same property+status
 * combo always produces the same token, so re-clicking is idempotent.
 */
export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return errRedirect(req, "サーバー設定エラー");
  }

  const u = new URL(req.url);
  const propertyId = u.searchParams.get("p") ?? "";
  const status = u.searchParams.get("s") ?? "";
  const token = u.searchParams.get("t") ?? "";

  if (!propertyId || !status || !token) {
    return errRedirect(req, "パラメータが不足しています");
  }
  if (!(VALID_STATUSES as readonly string[]).includes(status)) {
    return errRedirect(req, "不正なステータスです");
  }
  if (!verifyPropertyVerify(propertyId, status, token)) {
    return errRedirect(req, "リンクが無効です (秘密鍵不一致)");
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("properties")
    .update({
      availability_status: status,
      availability_updated_at: nowIso,
    })
    .eq("id", propertyId);
  if (error) {
    return errRedirect(req, "更新に失敗しました: " + error.message);
  }

  // 業者でも管理者でも開けるよう、汎用の確認ページに飛ばす。
  const origin = getOrigin(req);
  const dest = new URL(`${origin}/properties/${propertyId}/verified`);
  dest.searchParams.set("status", status);
  dest.searchParams.set("at", nowIso);
  return NextResponse.redirect(dest.toString());
}

function getOrigin(req: NextRequest): string {
  return req.headers.get("x-forwarded-host")
    ? `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get(
        "x-forwarded-host"
      )}`
    : new URL(req.url).origin;
}

function errRedirect(req: NextRequest, message: string): NextResponse {
  const origin = getOrigin(req);
  const u = new URL(`${origin}/verify-error`);
  u.searchParams.set("m", message);
  return NextResponse.redirect(u.toString());
}
