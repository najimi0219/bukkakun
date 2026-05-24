import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

interface LoginBody {
  email?: string;
}

/**
 * POST /api/login
 *
 * Auth-less "log back in" endpoint for the free beta. There are no
 * passwords: a tenant proved ownership of its email at /signup, and this
 * just looks that email back up so a browser that logged out — or an
 * entirely different device — can re-attach to the same tenant.
 *
 * This is intentionally weak (anyone who knows a registered email can
 * enter that tenant). That's an accepted trade-off for the beta scaffold
 * and gets replaced when we migrate to real Supabase Auth.
 *
 * Uses the service-role key so we can read the users table directly.
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

  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !/^.+@.+\..+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: "正しいメールアドレスを入力してください" },
      { status: 400 }
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Emails are unique across users (signup blocks dups), so the first row
  // is the only row. limit(1) keeps us safe even if that ever changes.
  const { data: users, error } = await supabase
    .from("users")
    .select("id, tenant_id, name")
    .eq("email", email)
    .limit(1);
  if (error) {
    console.error("[login] user lookup failed:", error);
    return NextResponse.json(
      { ok: false, error: "ログイン処理に失敗しました: " + error.message },
      { status: 500 }
    );
  }

  const user = users?.[0];
  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "このメールアドレスのアカウントが見つかりません。新規の方は『無料で始める』からご登録ください。",
      },
      { status: 404 }
    );
  }

  // Pull the tenant name so the page can greet the user after login.
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", user.tenant_id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    tenant_id: user.tenant_id,
    user_id: user.id,
    company_name: tenant?.name ?? "",
  });
}
