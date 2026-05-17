import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { signPropertyVerify } from "@/lib/verifyToken";

export const runtime = "nodejs";
// Vercel cron は HTTP timeout を 60s 持ってる。1テナント1物件ずつ
// 順番に送るので、200物件想定で 60s 上限内に収まる。
export const maxDuration = 60;

const STATUS_LABEL: Record<string, string> = {
  available: "公開中",
  reserved: "申込あり",
  negotiating: "商談中",
  closed: "終了",
};

/**
 * GET /api/cron/verify-properties
 *
 * Vercel Cron Jobs から日次で叩かれる。各テナントの公開中物件で：
 *   - verification_email_enabled = true
 *   - 最終送信から frequency_days 以上経過 (または未送信)
 * を満たすものに対し、状況確認メールを送る。
 *
 * 認証は Authorization: Bearer <CRON_SECRET> ヘッダで担保。
 * Vercel が cron 起動時に自動でこのヘッダを付けてくれる
 * (env vars に CRON_SECRET を入れる必要あり)。
 *
 * GET にしてるのは Vercel Cron が GET しか発行しないため。
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const defaultFrom =
    process.env.RESEND_DEFAULT_FROM ?? "BukkenLink <onboarding@resend.dev>";
  if (!url || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: "Supabase env vars missing" },
      { status: 500 }
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 対象物件: 公開中 + メール ON + (未送信 or 経過日数 OK)
  const { data: properties, error } = await supabase
    .from("properties")
    .select(
      "id, tenant_id, title, address, availability_status, verification_frequency_days, verification_last_emailed_at, status, verification_email_enabled"
    )
    .eq("status", "published")
    .eq("verification_email_enabled", true);
  if (error) {
    return NextResponse.json(
      { ok: false, error: "properties fetch failed: " + error.message },
      { status: 500 }
    );
  }

  const now = Date.now();
  const due = (properties ?? []).filter((p: any) => {
    const freqDays = (p.verification_frequency_days as number | null) ?? 1;
    const last = p.verification_last_emailed_at as string | null;
    if (!last) return true;
    const ageMs = now - new Date(last).getTime();
    return ageMs >= freqDays * 86_400_000;
  });

  if (due.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: properties?.length ?? 0 });
  }

  // テナントごとに必要なものをまとめて引いておく
  const tenantIds = Array.from(new Set(due.map((p: any) => p.tenant_id)));
  const [{ data: tenants }, { data: notifSettings }, { data: sendSettings }] =
    await Promise.all([
      supabase.from("tenants").select("id, name").in("id", tenantIds),
      supabase
        .from("notification_settings")
        .select("tenant_id, email_recipients")
        .in("tenant_id", tenantIds),
      supabase
        .from("email_send_settings")
        .select("tenant_id, from_display_name, reply_to_email, from_email, mode")
        .in("tenant_id", tenantIds),
    ]);

  const tenantById = new Map<string, any>(
    (tenants ?? []).map((t: any) => [t.id, t])
  );
  const notifByTenant = new Map<string, any>(
    (notifSettings ?? []).map((n: any) => [n.tenant_id, n])
  );
  const sendByTenant = new Map<string, any>(
    (sendSettings ?? []).map((s: any) => [s.tenant_id, s])
  );

  const origin =
    req.headers.get("x-forwarded-host")
      ? `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get(
          "x-forwarded-host"
        )}`
      : new URL(req.url).origin;
  const resend = resendKey ? new Resend(resendKey) : null;

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const p of due) {
    const tenant = tenantById.get(p.tenant_id);
    const notif = notifByTenant.get(p.tenant_id);
    const sendCfg = sendByTenant.get(p.tenant_id);
    if (!tenant || !notif?.email_recipients?.length) {
      // 通知先メアドが無いなら飛ばす
      continue;
    }

    const links = (
      ["available", "reserved", "negotiating", "closed"] as const
    ).map((s) => {
      const token = signPropertyVerify(p.id, s);
      const u = new URL(`${origin}/api/verify-property`);
      u.searchParams.set("p", p.id);
      u.searchParams.set("s", s);
      u.searchParams.set("t", token);
      return { status: s, label: STATUS_LABEL[s], url: u.toString() };
    });

    const subject = `【BukkenLink】販売状況の確認 - ${p.title}`;
    const body = [
      `${tenant.name} 様`,
      ``,
      `物件「${p.title}」(${p.address}) の現在の販売状況をご確認ください。`,
      `現状: ${STATUS_LABEL[p.availability_status ?? "available"]}`,
      ``,
      `▼ 該当する状況のリンクを1クリック → 即更新されます`,
      ``,
      ...links.map((l) => `● ${l.label}\n  ${l.url}`),
      ``,
      `(変更なしの場合は何もしなくてOKです。次回の定期確認メールまでお待ちください)`,
    ].join("\n");

    const fromDisplayName = sendCfg?.from_display_name ?? tenant.name;
    const fromEmail =
      sendCfg?.mode === "custom_domain" && sendCfg?.from_email
        ? sendCfg.from_email
        : "no-reply@bukkenlink.com";
    // bukkenlink.com は未verifyなので、Resend default に降ろす
    const fromHeader =
      fromEmail.endsWith("@bukkenlink.com")
        ? defaultFrom
        : `${fromDisplayName} <${fromEmail}>`;

    if (resend) {
      try {
        const result = await resend.emails.send({
          from: fromHeader,
          to: notif.email_recipients as string[],
          replyTo: sendCfg?.reply_to_email ?? undefined,
          subject,
          text: body,
        });
        if (result.error) {
          failed += 1;
          errors.push(p.id + ": " + (result.error.message ?? "send failed"));
          continue;
        }
      } catch (e) {
        failed += 1;
        errors.push(p.id + ": " + (e instanceof Error ? e.message : String(e)));
        continue;
      }
    }

    // 送信成功: 最終送信日時を更新
    await supabase
      .from("properties")
      .update({ verification_last_emailed_at: new Date().toISOString() })
      .eq("id", p.id);

    // sent_emails にも記録 (送信履歴ビューで見えるように)
    await supabase.from("sent_emails").insert({
      tenant_id: p.tenant_id,
      to_address: (notif.email_recipients as string[]).join(", "),
      subject,
      body,
      kind: "notification",
      from_email: fromEmail,
      from_display_name: fromDisplayName,
      reply_to: sendCfg?.reply_to_email ?? null,
      cc: null,
      send_mode: sendCfg?.mode ?? "relay_with_cc",
    });

    sent += 1;
  }

  return NextResponse.json({
    ok: true,
    total: properties?.length ?? 0,
    due: due.length,
    sent,
    failed,
    errors: errors.slice(0, 10),
  });
}
