import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

interface SignupBody {
  company_name?: string;
  contact_name?: string;
  email?: string;
  license_number?: string;
}

/**
 * POST /api/signup-tenant
 *
 * Auth-less "create a new tenant" endpoint used for the free beta rollout.
 * No passwords — we just create a tenant + admin user row in Supabase and
 * return their IDs. The browser stashes them in localStorage via
 * `lib/session.ts`, and from then on the app scopes everything to that
 * tenant_id.
 *
 * Uses the service-role key so we can bypass RLS (which is open right now
 * anyway, but this keeps the door closed for when we tighten it).
 */
export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: "Supabase env vars missing" },
      { status: 500 }
    );
  }

  let body: SignupBody;
  try {
    body = (await req.json()) as SignupBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const companyName = (body.company_name ?? "").trim();
  const contactName = (body.contact_name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const licenseNumber = (body.license_number ?? "").trim();

  if (!companyName) {
    return NextResponse.json(
      { ok: false, error: "会社名を入力してください" },
      { status: 400 }
    );
  }
  if (!contactName) {
    return NextResponse.json(
      { ok: false, error: "担当者名を入力してください" },
      { status: 400 }
    );
  }
  if (!email || !/^.+@.+\..+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: "正しいメールアドレスを入力してください" },
      { status: 400 }
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Quick dup-email check so we can return a friendly error instead of a
  // raw 23505 constraint violation.
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "このメールアドレスは既に登録されています。同じブラウザでサインアップ済みなら『ダッシュボードを開く』からアクセスしてください。",
      },
      { status: 409 }
    );
  }

  // Generate a URL-safe slug. The tenants table has a UNIQUE constraint on
  // slug, so append a short random suffix to avoid collisions when two
  // companies share a romanizable name (or when company_name is non-ASCII
  // and the romanization yields an empty string).
  const baseSlug =
    companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "tenant";
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`;

  // 1) tenant
  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .insert({
      name: companyName,
      slug,
      license_number: licenseNumber || "未設定",
      plan: "free",
    })
    .select("id")
    .single();
  if (tenantErr || !tenant) {
    console.error("[signup-tenant] tenant insert failed:", tenantErr);
    return NextResponse.json(
      {
        ok: false,
        error:
          (tenantErr?.message ?? "テナント作成に失敗しました") +
          (tenantErr?.code ? ` (code=${tenantErr.code})` : ""),
        details: tenantErr,
      },
      { status: 500 }
    );
  }

  // 2) admin user
  const { data: user, error: userErr } = await supabase
    .from("users")
    .insert({
      tenant_id: tenant.id,
      email,
      name: contactName,
      role: "admin",
    })
    .select("id")
    .single();
  if (userErr || !user) {
    console.error("[signup-tenant] user insert failed:", userErr);
    // Roll back the tenant we just created so we don't leak orphans.
    await supabase.from("tenants").delete().eq("id", tenant.id);
    return NextResponse.json(
      {
        ok: false,
        error:
          (userErr?.message ?? "ユーザー作成に失敗しました") +
          (userErr?.code ? ` (code=${userErr.code})` : ""),
        details: userErr,
      },
      { status: 500 }
    );
  }

  // 3) Seed sane defaults so the new tenant has something to look at and the
  //    UI doesn't show empty-state warnings on first login. All best-effort
  //    — if one fails we still let signup succeed.
  await supabase.from("email_templates").insert({
    tenant_id: tenant.id,
    name: "デフォルト自動返信",
    subject: "【{{物件名}}】資料ダウンロードのご案内",
    body: [
      "{{会社名}}",
      "{{担当者名}} 様",
      "",
      "お問い合わせありがとうございます。",
      "下記URLより物件資料をダウンロードください。",
      "",
      "{{資料URL}}",
      "",
      "有効期限:{{有効期限}}",
    ].join("\n"),
    is_default: true,
  });

  await supabase.from("notification_settings").insert({
    tenant_id: tenant.id,
    email_recipients: [email],
    timing: "immediate",
  });

  await supabase.from("email_send_settings").insert({
    tenant_id: tenant.id,
    mode: "relay_with_cc",
    from_display_name: companyName,
    reply_to_email: email,
    cc_emails: [email],
  });

  return NextResponse.json({
    ok: true,
    tenant_id: tenant.id,
    user_id: user.id,
  });
}
